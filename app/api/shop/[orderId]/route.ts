import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedCustomer, isPayloadAdmin } from "../../../../lib/auth";
import { getPayloadClient } from "../../../../lib/payload";

type RouteContext = { params: Promise<{ orderId: string }> };

/**
 * GET /api/orders/:orderId — Fetch a single order.
 *
 * Customers can only view their own orders.
 * Admins can view any order.
 */
export async function GET(request: NextRequest, context: RouteContext) {
	const { orderId } = await context.params;
	const customer = await getAuthenticatedCustomer(request);
	const admin = await isPayloadAdmin(request);

	if (!customer && !admin) {
		return NextResponse.json(
			{ error: "Authentication required." },
			{ status: 401 },
		);
	}

	try {
		const payload = await getPayloadClient();
		const order = await payload.findByID({
			collection: "orders",
			id: orderId,
			depth: 2, // populate customer + timeslot
		});

		if (!order) {
			return NextResponse.json({ error: "Order not found." }, { status: 404 });
		}

		// Non-admin users can only see their own orders
		if (!admin && customer) {
			const orderCustomerId =
				typeof order.customer === "object" ? order.customer.id : order.customer;
			if (orderCustomerId !== customer.customerId) {
				return NextResponse.json(
					{ error: "Order not found." },
					{ status: 404 },
				);
			}
		}

		return NextResponse.json({ success: true, order });
	} catch (error) {
		console.error("Error fetching order:", error);
		return NextResponse.json(
			{ error: "Failed to fetch order." },
			{ status: 500 },
		);
	}
}

/**
 * PATCH /api/orders/:orderId — Admin-only order updates.
 *
 * Used for:
 * - Updating status (e.g. PRINTED → PICKED_UP (after admin prints))
 * - Adding admin notes
 *
 * Body: `{ "status": "PICKED_UP", "adminNotes": "..." }`
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
	const { orderId } = await context.params;

	if (!(await isPayloadAdmin(request))) {
		return NextResponse.json(
			{ error: "Admin access required." },
			{ status: 403 },
		);
	}

	try {
		const body = await request.json();
		const payload = await getPayloadClient();

		const updateData: Record<string, unknown> = {};

		if (body.status) updateData.status = body.status;
		if (body.adminNotes !== undefined) updateData.adminNotes = body.adminNotes;

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
