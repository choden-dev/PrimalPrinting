import { type NextRequest, NextResponse } from "next/server";
import { isPayloadAdmin } from "../../../../../lib/auth";
import { getPayloadClient } from "../../../../../lib/payload";

type RouteContext = { params: Promise<{ orderId: string }> };

/**
 * POST /api/orders/:orderId/approve-payment
 *
 * Admin-only endpoint to mark a bank transfer payment as verified.
 * This is optional — for record keeping only. The order is already PAID
 * and the customer can proceed without verification.
 *
 * Sets the `bankTransferVerified` flag to true.
 */
export async function POST(request: NextRequest, context: RouteContext) {
	const { orderId } = await context.params;

	if (!(await isPayloadAdmin(request))) {
		return NextResponse.json(
			{ error: "Admin access required." },
			{ status: 403 },
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

		if (order.paymentMethod !== "BANK_TRANSFER") {
			return NextResponse.json(
				{
					error: "Only bank transfer orders can be verified.",
				},
				{ status: 400 },
			);
		}

		if (order.bankTransferVerified) {
			return NextResponse.json(
				{
					error: "This bank transfer payment has already been verified.",
				},
				{ status: 400 },
			);
		}

		// Mark as verified for record keeping
		const updated = await payload.update({
			collection: "orders",
			id: orderId,
			data: {
				bankTransferVerified: true,
			},
		});

		return NextResponse.json({
			success: true,
			order: {
				id: updated.id,
				orderNumber: updated.orderNumber,
				status: updated.status,
				bankTransferVerified: updated.bankTransferVerified,
			},
			message: "Bank transfer payment verified for record keeping.",
		});
	} catch (error) {
		console.error("Error verifying payment:", error);
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to verify payment.",
			},
			{ status: 500 },
		);
	}
}
