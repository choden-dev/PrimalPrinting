import { type NextRequest, NextResponse } from "next/server";
import { isPayloadAdmin } from "../../../../../lib/auth";
import { getPayloadClient } from "../../../../../lib/payload";
import {
	generateCustomerStagingKey,
	getPresignedUploadUrl,
} from "../../../../../lib/r2";
import {
	ALLOWED_FILE_TYPES,
	MAX_FILE_SIZE_BYTES,
	MAX_FILE_SIZE_MB,
	MAX_FILES_PER_ORDER,
	PRESIGN_TTL_SECONDS,
} from "../../../../../lib/uploadLimits";

/**
 * POST /api/admin/orders/staging-urls — Admin-only variant of
 * /api/shop/staging-urls used when an admin manually creates an order on
 * behalf of a customer (e.g. the customer couldn't upload their files on the
 * site). Issues presigned PUT URLs so the admin's browser can upload PDFs
 * directly to the R2 staging bucket.
 *
 * The crucial difference from the customer route is that the staging keys are
 * scoped to an explicit `customerId` (the target customer), not the caller.
 * This keeps the customer-ownership prefix intact so the later finalisation
 * step (see /api/admin/orders) can verify the files belong to that customer
 * and the customer can subsequently resume the order (timeslot + payment).
 */

export const runtime = "nodejs";
export const maxDuration = 10;

type RequestedUpload = {
	name?: unknown;
	size?: unknown;
	type?: unknown;
};

export async function POST(request: NextRequest) {
	if (!(await isPayloadAdmin(request))) {
		return NextResponse.json(
			{ error: "Admin access required." },
			{ status: 403 },
		);
	}

	let body: { customerId?: unknown; files?: RequestedUpload[] };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return NextResponse.json(
			{ error: "Request body must be valid JSON." },
			{ status: 400 },
		);
	}

	const customerId =
		typeof body?.customerId === "string" ? body.customerId : "";
	if (!customerId) {
		return NextResponse.json(
			{ error: "`customerId` is required." },
			{ status: 400 },
		);
	}

	const files = body?.files;
	if (!Array.isArray(files) || files.length === 0) {
		return NextResponse.json(
			{ error: "`files` must be a non-empty array." },
			{ status: 400 },
		);
	}

	if (files.length > MAX_FILES_PER_ORDER) {
		return NextResponse.json(
			{
				error: `Too many files (${files.length}). Maximum is ${MAX_FILES_PER_ORDER} per order.`,
			},
			{ status: 400 },
		);
	}

	// Validate every file descriptor up-front so we never issue a partial set
	// of presigned URLs for an order that's guaranteed to fail later.
	for (let i = 0; i < files.length; i++) {
		const f = files[i];
		const name = typeof f?.name === "string" ? f.name : "";
		const size = typeof f?.size === "number" ? f.size : Number.NaN;
		const type = typeof f?.type === "string" ? f.type : "";

		if (!name) {
			return NextResponse.json(
				{ error: `files[${i}].name is required and must be a string.` },
				{ status: 400 },
			);
		}
		if (!Number.isFinite(size) || size <= 0) {
			return NextResponse.json(
				{ error: `files[${i}].size must be a positive number of bytes.` },
				{ status: 400 },
			);
		}
		if (size > MAX_FILE_SIZE_BYTES) {
			const mb = (size / 1024 / 1024).toFixed(1);
			return NextResponse.json(
				{
					error: `"${name}" is ${mb}MB, which exceeds the ${MAX_FILE_SIZE_MB}MB per-file limit.`,
				},
				{ status: 413 },
			);
		}
		if (
			!ALLOWED_FILE_TYPES.includes(type as (typeof ALLOWED_FILE_TYPES)[number])
		) {
			return NextResponse.json(
				{
					error: `"${name}" has unsupported type "${type || "unknown"}". Only PDF files are accepted.`,
				},
				{ status: 415 },
			);
		}
	}

	// Verify the target customer actually exists before issuing any URLs.
	try {
		const payload = await getPayloadClient();
		await payload.findByID({ collection: "customers", id: customerId });
	} catch {
		return NextResponse.json({ error: "Customer not found." }, { status: 404 });
	}

	try {
		const uploads = await Promise.all(
			files.map(async (f) => {
				const name = f.name as string;
				const type = f.type as string;
				const stagingKey = generateCustomerStagingKey(customerId, name);
				const uploadUrl = await getPresignedUploadUrl(stagingKey, type, {
					expiresIn: PRESIGN_TTL_SECONDS,
				});
				return { stagingKey, uploadUrl, contentType: type };
			}),
		);

		return NextResponse.json({
			uploads,
			expiresInSeconds: PRESIGN_TTL_SECONDS,
		});
	} catch (error) {
		console.error("Failed to issue admin staging upload URLs:", error);
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? `Failed to issue upload URLs: ${error.message}`
						: "Failed to issue upload URLs.",
			},
			{ status: 500 },
		);
	}
}
