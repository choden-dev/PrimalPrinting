import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedCustomer } from "../../../../lib/auth";
import {
	generateCustomerStagingKey,
	getPresignedUploadUrl,
} from "../../../../lib/r2";

/**
 * POST /api/shop/staging-urls — Issue presigned PUT URLs so the browser can
 * upload PDFs directly to the R2 staging bucket.
 *
 * Request body (JSON):
 *   {
 *     files: [{ name: string, size: number, type: string }, ...]
 *   }
 *
 * Response (JSON):
 *   {
 *     uploads: [{ stagingKey: string, uploadUrl: string, contentType: string }, ...]
 *   }
 *
 * Each `uploadUrl` is signed for a short window (5 minutes) and only valid
 * for a PUT with a `Content-Type` header that exactly matches `contentType`.
 *
 * The order of `uploads` matches the order of the request `files`.
 *
 * The bytes never traverse our server / Cloudflare Worker — the browser PUTs
 * straight to R2. The server later verifies via HEAD that the upload
 * actually completed before pricing the order.
 */

export const runtime = "nodejs";
export const maxDuration = 10;

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB per file
const MAX_FILES_PER_ORDER = 25;
const ALLOWED_TYPES = ["application/pdf"];
const PRESIGN_TTL_SECONDS = 5 * 60;

type RequestedUpload = {
	name?: unknown;
	size?: unknown;
	type?: unknown;
};

export async function POST(request: NextRequest) {
	const customer = await getAuthenticatedCustomer(request);
	if (!customer) {
		return NextResponse.json(
			{ error: "Authentication required." },
			{ status: 401 },
		);
	}

	let body: { files?: RequestedUpload[] };
	try {
		body = (await request.json()) as { files?: RequestedUpload[] };
	} catch {
		return NextResponse.json(
			{ error: "Request body must be valid JSON." },
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
		if (size > MAX_FILE_SIZE) {
			const mb = (size / 1024 / 1024).toFixed(1);
			return NextResponse.json(
				{
					error: `"${name}" is ${mb}MB, which exceeds the ${MAX_FILE_SIZE / 1024 / 1024}MB per-file limit.`,
				},
				{ status: 413 },
			);
		}
		if (!ALLOWED_TYPES.includes(type)) {
			return NextResponse.json(
				{
					error: `"${name}" has unsupported type "${type || "unknown"}". Only PDF files are accepted.`,
				},
				{ status: 415 },
			);
		}
	}

	try {
		const uploads = await Promise.all(
			files.map(async (f) => {
				const name = f.name as string;
				const type = f.type as string;
				const stagingKey = generateCustomerStagingKey(
					customer.customerId,
					name,
				);
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
		console.error("Failed to issue staging upload URLs:", error);
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
