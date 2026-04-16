import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedCustomer } from "../../../../../lib/auth";
import { checkBankTransferEligibility } from "../../../../../lib/bankTransfer";
import { notifyBankTransferSubmitted } from "../../../../../lib/discord";
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

		// Verify eligibility: owns the order, correct status, no pending verification
		const check = await checkBankTransferEligibility(customer.customerId, {
			orderId,
		});
		if (!check.eligible) {
			return NextResponse.json(
				{ error: check.error },
				{ status: check.status },
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

		// Notify admin via Discord so they can verify the payment
		try {
			const total = order.pricing?.total;
			const formattedTotal =
				total != null ? `$${(total / 100).toFixed(2)}` : "N/A";

			await notifyBankTransferSubmitted({
				orderNumber: updated.orderNumber || orderId,
				customerName: customer.name,
				customerEmail: customer.email,
				totalFormatted: formattedTotal,
			});
		} catch (discordError) {
			console.error("Failed to send Discord notification:", discordError);
		}

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
