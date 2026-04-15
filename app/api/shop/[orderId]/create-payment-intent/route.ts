import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getAuthenticatedCustomer } from "../../../../../lib/auth";
import { getPayloadClient } from "../../../../../lib/payload";

type RouteContext = { params: Promise<{ orderId: string }> };

const stripe = new Stripe(process.env.STRIPE_PRIVATE_KEY || "", {
	apiVersion: "2022-11-15",
});

/**
 * POST /api/orders/:orderId/create-payment-intent
 *
 * Creates a Stripe PaymentIntent for the order total and transitions
 * the order status from DRAFT → AWAITING_PAYMENT.
 *
 * Returns the `clientSecret` for use with Stripe Elements on the frontend.
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

		// Order must be in DRAFT or AWAITING_PAYMENT status
		if (order.status !== "DRAFT" && order.status !== "AWAITING_PAYMENT") {
			return NextResponse.json(
				{
					error: `Cannot create payment for order in ${order.status} status.`,
				},
				{ status: 400 },
			);
		}

		const totalInCents = order.pricing?.total;
		if (!totalInCents || totalInCents <= 0) {
			return NextResponse.json(
				{ error: "Invalid order total." },
				{ status: 400 },
			);
		}

		// Create the PaymentIntent
		const paymentIntent = await stripe.paymentIntents.create({
			amount: totalInCents,
			currency: "aud",
			metadata: {
				orderId: order.id,
				orderNumber: order.orderNumber || "",
				customerId: customer.customerId,
			},
			receipt_email: customer.email,
		});

		// Transition to AWAITING_PAYMENT if still a DRAFT
		if (order.status === "DRAFT") {
			await payload.update({
				collection: "orders",
				id: orderId,
				data: {
					status: "AWAITING_PAYMENT",
					paymentMethod: "STRIPE",
				},
			});
		}

		return NextResponse.json({
			success: true,
			clientSecret: paymentIntent.client_secret,
			paymentIntentId: paymentIntent.id,
		});
	} catch (error) {
		console.error("Error creating payment intent:", error);
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to create payment intent.",
			},
			{ status: 500 },
		);
	}
}
