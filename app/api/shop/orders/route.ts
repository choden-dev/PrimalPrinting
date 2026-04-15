import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedCustomer } from "../../../../lib/auth";
import { getPayloadClient } from "../../../../lib/payload";
import { generateStagingKey, uploadToStaging } from "../../../../lib/r2";
import { calculateOrderTotal } from "../../../../lib/stripe";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB per file

/**
 * Count PDF pages by scanning for /Type /Page markers in the raw buffer.
 * Lightweight — no external dependencies, no Object.defineProperty issues.
 */
function countPdfPages(buffer: Buffer): number {
	const text = buffer.toString("latin1");
	let count = 0;
	let pos = 0;

	while (true) {
		const idx = text.indexOf("/Type", pos);
		if (idx === -1) break;

		const after = text.substring(idx + 5, idx + 30).trimStart();
		if (after.startsWith("/Page") && !after.startsWith("/Pages")) {
			count++;
		}
		pos = idx + 5;
	}

	return Math.max(count, 0);
}

/**
 * POST /api/shop/orders — Create a new DRAFT order.
 *
 * Accepts multipart/form-data with:
 * - `files` (one or more PDF files)
 * - `metadata` (JSON string with per-file config: copies, colorMode)
 *
 * Files are uploaded to R2 staging, pages counted server-side,
 * pricing calculated server-side. No client-provided staging keys
 * or page counts are accepted.
 */
export async function POST(request: NextRequest) {
	const customer = await getAuthenticatedCustomer(request);
	if (!customer) {
		return NextResponse.json(
			{ error: "Authentication required." },
			{ status: 401 },
		);
	}

	try {
		const formData = await request.formData();
		const metadataRaw = formData.get("metadata") as string | null;

		if (!metadataRaw) {
			return NextResponse.json(
				{ error: "metadata field is required." },
				{ status: 400 },
			);
		}

		const metadata: {
			copies?: number;
			colorMode?: string;
		}[] = JSON.parse(metadataRaw);

		// Collect all files from the form data
		const fileEntries: File[] = [];
		for (const [key, value] of formData.entries()) {
			if (key === "files" && value instanceof File) {
				fileEntries.push(value);
			}
		}

		if (fileEntries.length === 0) {
			return NextResponse.json(
				{ error: "At least one file is required." },
				{ status: 400 },
			);
		}

		if (fileEntries.length !== metadata.length) {
			return NextResponse.json(
				{ error: "Metadata count must match file count." },
				{ status: 400 },
			);
		}

		const payload = await getPayloadClient();

		// Generate a temporary order number for staging keys
		const tempOrderNumber = `DRAFT-${customer.customerId}-${Date.now()}`;

		// Process each file: validate, upload to R2, count pages
		const orderFiles = await Promise.all(
			fileEntries.map(async (file, i) => {
				if (file.type !== "application/pdf") {
					throw new Error(`${file.name}: Only PDF files are accepted.`);
				}
				if (file.size > MAX_FILE_SIZE) {
					throw new Error(
						`${file.name}: File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
					);
				}

				const buffer = Buffer.from(await file.arrayBuffer());

				// Count pages in memory — authoritative, no client input
				const pageCount = countPdfPages(buffer);
				if (pageCount < 1) {
					throw new Error(
						`${file.name}: Unable to read PDF. Please ensure it's a valid PDF file.`,
					);
				}

				// Upload to R2 staging
				const stagingKey = generateStagingKey(tempOrderNumber, file.name);
				await uploadToStaging(stagingKey, buffer, file.type);

				const fileMeta = metadata[i] || {};

				return {
					fileName: file.name,
					stagingKey,
					pageCount,
					copies: fileMeta.copies || 1,
					colorMode: fileMeta.colorMode || "BW",
					fileSize: file.size,
				};
			}),
		);

		// Calculate pricing server-side from verified page counts
		const pricing = await calculateOrderTotal(orderFiles);

		// Set expiry to 7 days from now
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + 7);

		const order = await payload.create({
			collection: "orders",
			data: {
				customer: customer.customerId,
				status: "DRAFT",
				files: orderFiles,
				pricing: {
					subtotal: pricing.subtotal,
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
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to create order.",
			},
			{ status: 500 },
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
