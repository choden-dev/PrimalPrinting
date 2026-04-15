import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedCustomer } from "../../../../../lib/auth";
import { sendOrderConfirmationEmail } from "../../../../../lib/email";
import { getPayloadClient } from "../../../../../lib/payload";

type RouteContext = { params: Promise<{ orderId: string }> };

/**
 * POST /api/orders/:orderId/select-timeslot
 *
 * Customer selects a pickup timeslot for a PAID order.
 * Transitions: PAID → AWAITING_PICKUP
 * Triggers order confirmation email with pickup details.
 *
 * Body: `{ "timeslotId": "..." }`
 */
export async function POST(request: NextRequest, context: RouteContext) {
	const { orderId } = await context.params;
	const customer = await getAuthenticatedCustomer(request);

	if (!customer) {
		return NextResponse.json(
			{ error: "Authentication required." },
			{ status: 401 },
		);
	}

	try {
		const body = await request.json();
		const { timeslotId } = body;

		if (!timeslotId) {
			return NextResponse.json(
				{ error: "timeslotId is required." },
				{ status: 400 },
			);
		}

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

		if (order.status !== "PAID") {
			return NextResponse.json(
				{
					error: `Cannot select timeslot for order in ${order.status} status. Order must be PAID.`,
				},
				{ status: 400 },
			);
		}

		// Verify timeslot exists and is active
		const timeslot = await payload.findByID({
			collection: "timeslots",
			id: timeslotId,
		});

		if (!timeslot || !timeslot.isActive) {
			return NextResponse.json(
				{ error: "Selected timeslot is not available." },
				{ status: 400 },
			);
		}

		// Transition to AWAITING_PICKUP
		const updated = await payload.update({
			collection: "orders",
			id: orderId,
			data: {
				status: "AWAITING_PICKUP",
				pickupTimeslot: timeslotId,
			},
		});

		// Send confirmation email
		try {
			await sendOrderConfirmationEmail({
				to: customer.email,
				customerName: customer.name,
				orderNumber: order.orderNumber || "",
				files: order.files || [],
				pricing: order.pricing,
				timeslot: {
					date: timeslot.date || "",
					startTime: timeslot.startTime || "",
					endTime: timeslot.endTime || "",
					label: timeslot.label || "",
				},
			});
		} catch (emailError) {
			// Log but don't fail the request – order is already updated
			console.error("Failed to send confirmation email:", emailError);
		}

		return NextResponse.json({
			success: true,
			order: {
				id: updated.id,
				orderNumber: updated.orderNumber,
				status: updated.status,
				pickupTimeslot: timeslot,
			},
			message: "Pickup timeslot confirmed. Confirmation email sent.",
		});
	} catch (error) {
		console.error("Error selecting timeslot:", error);
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to select timeslot.",
			},
			{ status: 500 },
		);
	}
}
