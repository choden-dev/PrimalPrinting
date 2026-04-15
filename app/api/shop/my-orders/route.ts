import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedCustomer } from "../../../../lib/auth";
import { getPayloadClient } from "../../../../lib/payload";

/**
 * GET /api/shop/my-orders — Fetch all orders for the authenticated customer.
 *
 * Query params:
 * - `page` (number, default 1)
 * - `limit` (number, default 20, max 100)
 * - `status` (optional filter, e.g. "PAID" or "DRAFT")
 */
export async function GET(request: NextRequest) {
	const customer = await getAuthenticatedCustomer(request);
	if (!customer) {
		return NextResponse.json(
			{ error: "Authentication required." },
			{ status: 401 },
		);
	}

	try {
		const { searchParams } = new URL(request.url);
		const page = Math.max(1, Number(searchParams.get("page")) || 1);
		const limit = Math.min(
			100,
			Math.max(1, Number(searchParams.get("limit")) || 20),
		);
		const statusFilter = searchParams.get("status");

		const payload = await getPayloadClient();

		const where: Record<string, unknown> = {
			customer: { equals: customer.customerId },
		};

		if (statusFilter) {
			where.status = { equals: statusFilter };
		}

		const result = await payload.find({
			collection: "orders",
			where,
			page,
			limit,
			sort: "-createdAt",
			depth: 1, // populate timeslot relationship
		});

		return NextResponse.json({
			success: true,
			orders: result.docs.map((order) => ({
				id: order.id,
				orderNumber: order.orderNumber,
				status: order.status,
				paymentMethod: order.paymentMethod,
				files: order.files,
				pricing: order.pricing,
				pickupTimeslot: order.pickupTimeslot,
				expiresAt: order.expiresAt,
				paidAt: order.paidAt,
				pickedUpAt: order.pickedUpAt,
				createdAt: order.createdAt,
				updatedAt: order.updatedAt,
			})),
			pagination: {
				page: result.page,
				totalPages: result.totalPages,
				totalDocs: result.totalDocs,
				hasNextPage: result.hasNextPage,
				hasPrevPage: result.hasPrevPage,
			},
		});
	} catch (error) {
		console.error("Error fetching orders:", error);
		return NextResponse.json(
			{ error: "Failed to fetch orders." },
			{ status: 500 },
		);
	}
}
