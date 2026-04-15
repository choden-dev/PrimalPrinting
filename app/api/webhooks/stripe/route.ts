import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getPayloadClient } from "../../../../lib/payload";
import { transferOrderFiles } from "../../../../lib/r2";

const stripe = new Stripe(process.env.STRIPE_PRIVATE_KEY || "", {
	apiVersion: "2022-11-15",
});

/**
 * POST /api/webhooks/stripe — Stripe webhook handler.
 *
 * Listens for `payment_intent.succeeded` events to:
 * 1. Transition the order to PAID
 * 2. Transfer files from staging → permanent R2 bucket
 * 3. Clear the order expiry
 *
 * Requires STRIPE_WEBHOOK_SECRET to verify event signatures.
 */
export async function POST(request: NextRequest) {
	const body = await request.text();
	const signature = request.headers.get("stripe-signature");

	if (!signature) {
		return NextResponse.json(
			{ error: "Missing stripe-signature header." },
			{ status: 400 },
		);
	}

	let event: Stripe.Event;

	try {
		event = stripe.webhooks.constructEvent(
			body,
			signature,
			process.env.STRIPE_WEBHOOK_SECRET || "",
		);
	} catch (err) {
		console.error("Stripe webhook signature verification failed:", err);
		return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
	}

	if (event.type === "payment_intent.succeeded") {
		const paymentIntent = event.data.object as Stripe.PaymentIntent;
		const orderId = paymentIntent.metadata?.orderId;

		if (!orderId) {
			console.error("Stripe webhook: No orderId in PaymentIntent metadata.");
			return NextResponse.json({ received: true });
		}

		try {
			const payload = await getPayloadClient();
			const order = await payload.findByID({
				collection: "orders",
				id: orderId,
			});

			if (!order) {
				console.error(`Stripe webhook: Order ${orderId} not found.`);
				return NextResponse.json({ received: true });
			}

			// Only process if order is awaiting payment
			if (order.status !== "AWAITING_PAYMENT") {
				console.warn(
					`Stripe webhook: Order ${orderId} is in ${order.status} status, skipping.`,
				);
				return NextResponse.json({ received: true });
			}

			// Mark as PAID immediately so the user sees the update fast
			await payload.update({
				collection: "orders",
				id: orderId,
				data: {
					status: "PAID",
					stripePaymentId: paymentIntent.id,
				},
			});

			console.log(`Stripe webhook: Order ${order.orderNumber} marked as PAID.`);

			// Transfer files from staging → permanent in the background
			const files = order.files || [];
			try {
				const transferMap = await transferOrderFiles(
					files.map((f: { stagingKey: string }) => ({
						stagingKey: f.stagingKey,
					})),
				);

				const updatedFiles = files.map(
					(f: {
						stagingKey: string;
						permanentKey?: string;
						fileName?: string;
						pageCount?: number;
						copies?: number;
						colorMode?: string;
						paperSize?: string;
						doubleSided?: boolean;
						fileSize?: number;
					}) => ({
						...f,
						permanentKey: transferMap.get(f.stagingKey) || f.stagingKey,
					}),
				);

				await payload.update({
					collection: "orders",
					id: orderId,
					data: { files: updatedFiles },
				});

				console.log(
					`Stripe webhook: Files transferred for order ${order.orderNumber}.`,
				);
			} catch (transferError) {
				// Log but don't fail — order is already PAID, files can be retried
				console.error(
					`Stripe webhook: File transfer failed for order ${order.orderNumber}:`,
					transferError,
				);
			}
		} catch (error) {
			console.error("Stripe webhook: Error processing payment:", error);
			// Return 500 so Stripe retries
			return NextResponse.json(
				{ error: "Internal processing error." },
				{ status: 500 },
			);
		}
	}

	return NextResponse.json({ received: true });
}
