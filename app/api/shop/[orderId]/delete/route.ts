import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedCustomer } from "../../../../../lib/auth";
import { getPayloadClient } from "../../../../../lib/payload";

type RouteContext = { params: Promise<{ orderId: string }> };

/** Statuses that customers are allowed to delete themselves */
const CUSTOMER_DELETABLE_STATUSES = ["DRAFT", "AWAITING_PAYMENT", "EXPIRED"];

/**
 * DELETE /api/shop/:orderId/delete
 *
 * Allows a customer to delete their own order if it's in a deletable status.
 * File cleanup is handled by the afterDelete hook on the Orders collection.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
	const { orderId } = await context.params;
	const customer = await getAuthenticatedCustomer(request);

	if (!customer) {
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
		});

		if (!order) {
			return NextResponse.json({ error: "Order not found." }, { status: 404 });
		}

		// Verify ownership
		const orderCustomerId =
			typeof order.customer === "object" ? order.customer.id : order.customer;
		if (orderCustomerId !== customer.customerId) {
			return NextResponse.json({ error: "Order not found." }, { status: 404 });
		}

		// Only allow deletion of orders in certain statuses
		if (!CUSTOMER_DELETABLE_STATUSES.includes(order.status)) {
			return NextResponse.json(
				{
					error: `Cannot delete an order in ${order.status} status. Only draft, pending, and expired orders can be deleted.`,
				},
				{ status: 400 },
			);
		}

		// Delete the order — afterDelete hook handles file cleanup
		await payload.delete({
			collection: "orders",
			id: orderId,
		});

		return NextResponse.json({
			success: true,
			message: "Order deleted.",
		});
	} catch (error) {
		console.error("Error deleting order:", error);
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to delete order.",
			},
			{ status: 500 },
		);
	}
}
