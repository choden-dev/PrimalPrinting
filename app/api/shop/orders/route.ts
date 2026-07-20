import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedCustomer } from "../../../../lib/auth";
import { getPayloadClient } from "../../../../lib/payload";
import { countPdfPages } from "../../../../lib/pdf";
import {
	cleanupStagingFiles,
	downloadFromStaging,
	headStagingObject,
	isCustomerStagingKey,
} from "../../../../lib/r2";
import { calculateOrderTotal } from "../../../../lib/stripe";
import {
	ALLOWED_FILE_TYPES,
	MAX_FILE_SIZE_BYTES,
	MAX_FILE_SIZE_MB,
	MAX_FILES_PER_ORDER,
} from "../../../../lib/uploadLimits";

// Run on the Node.js runtime — required for Buffer + the S3 client used by
// downloadFromStaging.
export const runtime = "nodejs";
// HEAD + page-counting downloads of every file can take a while at max size.
export const maxDuration = 60;

/**
 * POST /api/shop/orders — Finalise a DRAFT order from staging files the
 * browser already uploaded directly to R2 (see /api/shop/staging-urls).
 *
 * Everything is verified server-side: staging keys must belong to the
 * customer, objects are HEADed and downloaded to count pages, and pricing
 * is computed from the verified counts. Verified staging objects are cleaned
 * up on failure so they don't linger in R2.
 */
export async function POST(request: NextRequest) {
	const customer = await getAuthenticatedCustomer(request);
	if (!customer) {
		return NextResponse.json(
			{ error: "Authentication required." },
			{ status: 401 },
		);
	}

	let body: {
		files?: Array<{
			stagingKey?: unknown;
			fileName?: unknown;
			copies?: unknown;
			colorMode?: unknown;
		}>;
	};
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return NextResponse.json(
			{ error: "Request body must be valid JSON." },
			{ status: 400 },
		);
	}

	const requestedFiles = body?.files;
	if (!Array.isArray(requestedFiles) || requestedFiles.length === 0) {
		return NextResponse.json(
			{ error: "`files` must be a non-empty array." },
			{ status: 400 },
		);
	}

	if (requestedFiles.length > MAX_FILES_PER_ORDER) {
		return NextResponse.json(
			{
				error: `Too many files (${requestedFiles.length}). Maximum is ${MAX_FILES_PER_ORDER} per order.`,
			},
			{ status: 400 },
		);
	}

	// Validate the shape of every entry up-front so we don't do any R2 work
	// on a request that's guaranteed to fail validation later.
	type ValidatedRequest = {
		stagingKey: string;
		fileName: string;
		copies: number;
		colorMode: "BW" | "COLOR";
	};
	const validated: ValidatedRequest[] = [];
	for (let i = 0; i < requestedFiles.length; i++) {
		const f = requestedFiles[i];
		const stagingKey = typeof f?.stagingKey === "string" ? f.stagingKey : "";
		const fileName = typeof f?.fileName === "string" ? f.fileName : "";
		const copiesRaw = typeof f?.copies === "number" ? f.copies : 1;
		const colorModeRaw = typeof f?.colorMode === "string" ? f.colorMode : "BW";

		if (!stagingKey) {
			return NextResponse.json(
				{ error: `files[${i}].stagingKey is required.` },
				{ status: 400 },
			);
		}
		if (!fileName) {
			return NextResponse.json(
				{ error: `files[${i}].fileName is required.` },
				{ status: 400 },
			);
		}
		if (!isCustomerStagingKey(stagingKey, customer.customerId)) {
			// The client is referencing a staging key that doesn't belong to
			// them. Treat as 403 — never reveal whether the key exists.
			return NextResponse.json(
				{
					error: `files[${i}]: staging key does not belong to the current customer.`,
				},
				{ status: 403 },
			);
		}
		if (!Number.isFinite(copiesRaw) || copiesRaw < 1 || copiesRaw > 1000) {
			return NextResponse.json(
				{
					error: `files[${i}].copies must be an integer between 1 and 1000.`,
				},
				{ status: 400 },
			);
		}
		if (colorModeRaw !== "BW" && colorModeRaw !== "COLOR") {
			return NextResponse.json(
				{ error: `files[${i}].colorMode must be "BW" or "COLOR".` },
				{ status: 400 },
			);
		}

		validated.push({
			stagingKey,
			fileName,
			copies: Math.floor(copiesRaw),
			colorMode: colorModeRaw,
		});
	}

	// Track which staging keys we've successfully verified so we can clean
	// them up if something later fails (e.g. Payload create error).
	const verifiedKeys: string[] = [];

	try {
		// Step 1: HEAD every object to confirm the upload completed and read
		// authoritative size + content-type from R2.
		const headed = await Promise.all(
			validated.map(async (v) => {
				const head = await headStagingObject(v.stagingKey);
				if (!head) {
					throw new Error(
						`"${v.fileName}" was not received by storage. Please try uploading again.`,
					);
				}
				if (head.contentLength === 0) {
					throw new Error(
						`"${v.fileName}" arrived as an empty file. Please try uploading again.`,
					);
				}
				if (head.contentLength > MAX_FILE_SIZE_BYTES) {
					const mb = (head.contentLength / 1024 / 1024).toFixed(1);
					throw new Error(
						`"${v.fileName}" is ${mb}MB, which exceeds the ${MAX_FILE_SIZE_MB}MB per-file limit.`,
					);
				}
				if (
					!ALLOWED_FILE_TYPES.includes(
						head.contentType as (typeof ALLOWED_FILE_TYPES)[number],
					)
				) {
					throw new Error(
						`"${v.fileName}" has unsupported type "${head.contentType}". Only PDF files are accepted.`,
					);
				}
				verifiedKeys.push(v.stagingKey);
				return { ...v, fileSize: head.contentLength };
			}),
		);

		// Step 2: Download each PDF and count pages server-side — never trust
		// client-supplied counts, since pricing depends on them.
		const orderFiles = await Promise.all(
			headed.map(async (v) => {
				const buffer = await downloadFromStaging(v.stagingKey);
				const pageCount = await countPdfPages(buffer);
				if (pageCount < 1) {
					throw new Error(
						`"${v.fileName}": Unable to read PDF. Please ensure it's a valid PDF file.`,
					);
				}
				return {
					fileName: v.fileName,
					stagingKey: v.stagingKey,
					pageCount,
					copies: v.copies,
					colorMode: v.colorMode,
					fileSize: v.fileSize,
				};
			}),
		);

		// Step 3: Calculate pricing server-side.
		const pricing = await calculateOrderTotal(orderFiles);

		// Step 4: Create the DRAFT order. Expires in 7 days.
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + 7);

		const payload = await getPayloadClient();
		const order = await payload.create({
			collection: "orders",
			data: {
				customer: customer.customerId,
				status: "DRAFT",
				files: orderFiles,
				pricing: {
					subtotal: pricing.subtotal,
					discount: pricing.discount,
					tax: 0,
					total: pricing.total,
				},
				expiresAt: expiresAt.toISOString(),
			},
		});

		return NextResponse.json({
			success: true,
			order: {
				id: order.id,
				orderNumber: order.orderNumber,
				status: order.status,
				pricing: order.pricing,
				expiresAt: order.expiresAt,
			},
		});
	} catch (error) {
		console.error("Error creating order:", error);

		// Best-effort cleanup of any verified staging objects so we don't
		// leave orphaned uploads in R2 after a failed finalisation.
		if (verifiedKeys.length > 0) {
			cleanupStagingFiles(verifiedKeys.map((k) => ({ stagingKey: k }))).catch(
				(cleanupErr) => {
					console.error(
						"Failed to clean up staging files after order error:",
						cleanupErr,
					);
				},
			);
		}

		// Pass through descriptive Error messages thrown by the validation /
		// verification steps; everything else gets a generic 500.
		const message =
			error instanceof Error ? error.message : "Failed to create order.";
		const isUserError =
			error instanceof Error &&
			/please|must|exceeds|unsupported|empty|not received|valid PDF|no print product is configured|no default price configured|stripe catalogue/i.test(
				error.message,
			);
		return NextResponse.json(
			{ error: message },
			{ status: isUserError ? 400 : 500 },
		);
	}
}

/**
 * PATCH /api/shop/orders — Update a DRAFT order.
 *
 * Body (JSON): `{ "orderId": "..." }`
 * Currently only supports non-file updates. To change files,
 * delete the order and create a new one.
 */
export async function PATCH(request: NextRequest) {
	const customer = await getAuthenticatedCustomer(request);
	if (!customer) {
		return NextResponse.json(
			{ error: "Authentication required." },
			{ status: 401 },
		);
	}

	try {
		const body = await request.json();
		const { orderId } = body;

		if (!orderId) {
			return NextResponse.json(
				{ error: "orderId is required." },
				{ status: 400 },
			);
		}

		const payload = await getPayloadClient();

		const existing = await payload.findByID({
			collection: "orders",
			id: orderId,
		});

		const existingCustomerId =
			typeof existing.customer === "object"
				? existing.customer.id
				: existing.customer;

		if (existingCustomerId !== customer.customerId) {
			return NextResponse.json({ error: "Order not found." }, { status: 404 });
		}

		if (existing.status !== "DRAFT") {
			return NextResponse.json(
				{ error: "Only DRAFT orders can be modified." },
				{ status: 400 },
			);
		}

		return NextResponse.json({
			success: true,
			order: {
				id: existing.id,
				orderNumber: existing.orderNumber,
				status: existing.status,
			},
		});
	} catch (error) {
		console.error("Error updating order:", error);
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to update order.",
			},
			{ status: 500 },
		);
	}
}
