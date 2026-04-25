import { type NextRequest, NextResponse } from "next/server";
import { isPayloadAdmin } from "../../../../../lib/auth";
import {
	pickupProfileToHtml,
	sendBankTransferReceivedEmail,
	sendOrderConfirmationEmail,
	sendPaymentConfirmationEmail,
} from "../../../../../lib/email";
import { getPayloadClient } from "../../../../../lib/payload";

type RouteContext = { params: Promise<{ orderId: string }> };

/**
 * POST /api/shop/:orderId/resend-confirmation
 *
 * Admin-only endpoint to resend a confirmation email for an order.
 * Sends the appropriate email based on the order's current state:
 *
 * - AWAITING_PICKUP / PRINTED / PICKED_UP (has timeslot): full order confirmation with pickup details
 * - PAID (no timeslot yet): payment confirmation with timeslot availability info
 * - PAID + BANK_TRANSFER: bank transfer received email
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
			depth: 1, // populate customer and timeslot
		});

		if (!order) {
			return NextResponse.json({ error: "Order not found." }, { status: 404 });
		}

		// Get customer email
		const customer = typeof order.customer === "object" ? order.customer : null;

		if (!customer?.email) {
			return NextResponse.json(
				{ error: "No customer email found for this order." },
				{ status: 400 },
			);
		}

		const customerName = customer.name || "Customer";
		const orderNumber = order.orderNumber || orderId;

		// Determine which email to send based on order state
		const timeslot =
			typeof order.pickupTimeslot === "object" ? order.pickupTimeslot : null;

		if (timeslot) {
			// Order has a timeslot — send full order confirmation with pickup details
			await sendOrderConfirmationEmail({
				to: customer.email,
				customerName,
				orderNumber,
				files: order.files || [],
				pricing: order.pricing,
				timeslot: {
					date: timeslot.date || "",
					startTime: timeslot.startTime || "",
					endTime: timeslot.endTime || "",
					label: timeslot.label || "",
				},
				pickupInstructionsHtml: pickupProfileToHtml(
					timeslot.pickupInstructionProfile,
				),
			});

			return NextResponse.json({
				success: true,
				message: `Order confirmation email (with pickup details) resent to ${customer.email}.`,
			});
		}

		// No timeslot — check if there are active timeslots available
		let hasTimeslots = false;
		try {
			const timeslots = await payload.find({
				collection: "timeslots",
				where: { isActive: { equals: true } },
				limit: 1,
			});
			hasTimeslots = timeslots.totalDocs > 0;
		} catch {
			// Default to false
		}

		if (order.paymentMethod === "BANK_TRANSFER") {
			// Bank transfer — send the bank transfer received email
			await sendBankTransferReceivedEmail({
				to: customer.email,
				customerName,
				orderNumber,
				files: order.files || [],
				pricing: order.pricing,
				hasTimeslots,
			});

			return NextResponse.json({
				success: true,
				message: `Bank transfer confirmation email resent to ${customer.email}.`,
			});
		}

		// Stripe or other — send payment confirmation email
		await sendPaymentConfirmationEmail({
			to: customer.email,
			customerName,
			orderNumber,
			files: order.files || [],
			pricing: order.pricing,
			hasTimeslots,
		});

		return NextResponse.json({
			success: true,
			message: `Payment confirmation email resent to ${customer.email}.`,
		});
	} catch (error) {
		console.error("Error resending confirmation email:", error);
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to resend confirmation email.",
			},
			{ status: 500 },
		);
	}
}
