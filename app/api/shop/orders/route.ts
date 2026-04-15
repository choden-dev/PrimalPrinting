import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedCustomer } from "../../../../lib/auth";
import { getPayloadClient } from "../../../../lib/payload";
import { getVerifiedPageCount } from "../../../../lib/r2";
import { calculateOrderTotal } from "../../../../lib/stripe";

/**
 * POST /api/orders — Create a new DRAFT order.
 *
 * Body:
 * ```json
 * {
 *   "files": [
 *     {
 *       "fileName": "thesis.pdf",
 *       "stagingKey": "orders/ORD-20260415-A3F8/uuid-thesis.pdf",
 *       "pageCount": 42,
 *       "copies": 2,
 *       "colorMode": "BW",
 *       "paperSize": "A4",
 *       "doubleSided": true,
 *       "fileSize": 1048576
 *     }
 *   ],
 *   "pricing": { "subtotal": 2100, "tax": 210, "total": 2310 }
 * }
 * ```
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
		const body = await request.json();
		const { files } = body;

		if (!files || !Array.isArray(files) || files.length === 0) {
			return NextResponse.json(
				{ error: "At least one file is required." },
				{ status: 400 },
			);
		}

		const payload = await getPayloadClient();

		// Map file data — page counts come exclusively from server-side verification
		const orderFiles = await Promise.all(
			files.map(
				async (f: {
					fileName: string;
					stagingKey: string;
					copies?: number;
					colorMode?: string;
					fileSize?: number;
				}) => {
					// Get verified page count — never trust the client
					const pageCount = await getVerifiedPageCount(f.stagingKey);
					if (pageCount === null) {
						throw new Error(
							`Unable to verify page count for ${f.fileName}. Please re-upload the file.`,
						);
					}

					return {
						fileName: f.fileName,
						stagingKey: f.stagingKey,
						pageCount,
						copies: f.copies || 1,
						colorMode: f.colorMode || "BW",
						fileSize: f.fileSize || 0,
					};
				},
			),
		);

		// Calculate pricing from verified page counts
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
 * PATCH /api/orders — Update a DRAFT order (add/remove files, update pricing).
 *
 * Body: `{ "orderId": "...", "files": [...], "pricing": {...} }`
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
		const { orderId, files, pricing } = body;

		if (!orderId) {
			return NextResponse.json(
				{ error: "orderId is required." },
				{ status: 400 },
			);
		}

		const payload = await getPayloadClient();

		// Verify the order belongs to this customer and is still a DRAFT
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

		const updateData: Record<string, unknown> = {};
		if (files) updateData.files = files;
		if (pricing) updateData.pricing = pricing;

		const updated = await payload.update({
			collection: "orders",
			id: orderId,
			data: updateData,
		});

		return NextResponse.json({
			success: true,
			order: {
				id: updated.id,
				orderNumber: updated.orderNumber,
				status: updated.status,
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
