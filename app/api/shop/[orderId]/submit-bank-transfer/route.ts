import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedCustomer } from "../../../../../lib/auth";
import { getPayloadClient } from "../../../../../lib/payload";

type RouteContext = { params: Promise<{ orderId: string }> };

/**
 * POST /api/orders/:orderId/submit-bank-transfer
 *
 * Submits proof of bank transfer payment. Transitions the order from
 * DRAFT/AWAITING_PAYMENT → PAYMENT_PENDING_VERIFICATION.
 *
 * Body: `{ "proofKey": "proofs/ORD-20260415-A3F8/uuid.webp" }`
 *
 * The `proofKey` should come from the `/api/shop/upload-proof` endpoint.
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
		const { proofKey } = body;

		if (!proofKey || typeof proofKey !== "string") {
			return NextResponse.json(
				{ error: "proofKey is required (upload proof image first)." },
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

		// Must be in DRAFT or AWAITING_PAYMENT
		if (order.status !== "DRAFT" && order.status !== "AWAITING_PAYMENT") {
			return NextResponse.json(
				{
					error: `Cannot submit bank transfer for order in ${order.status} status.`,
				},
				{ status: 400 },
			);
		}

		// First move to AWAITING_PAYMENT if still DRAFT
		if (order.status === "DRAFT") {
			await payload.update({
				collection: "orders",
				id: orderId,
				data: {
					status: "AWAITING_PAYMENT",
					paymentMethod: "BANK_TRANSFER",
				},
			});
		}

		// Then transition to PAYMENT_PENDING_VERIFICATION
		const updated = await payload.update({
			collection: "orders",
			id: orderId,
			data: {
				status: "PAYMENT_PENDING_VERIFICATION",
				bankTransferProofKey: proofKey,
				paymentMethod: "BANK_TRANSFER",
			},
		});

		// TODO: Send notification to admin (email or Slack webhook)

		return NextResponse.json({
			success: true,
			order: {
				id: updated.id,
				orderNumber: updated.orderNumber,
				status: updated.status,
			},
			message:
				"Bank transfer proof submitted. Your payment will be verified by an admin.",
		});
	} catch (error) {
		console.error("Error submitting bank transfer:", error);
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to submit bank transfer.",
			},
			{ status: 500 },
		);
	}
}
