import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedCustomer } from "../../../../../lib/auth";
import { checkBankTransferEligibility } from "../../../../../lib/bankTransfer";
import { notifyBankTransferSubmitted } from "../../../../../lib/discord";
import { sendBankTransferReceivedEmail } from "../../../../../lib/email";
import { getPayloadClient } from "../../../../../lib/payload";
import { transferOrderFiles } from "../../../../../lib/r2";

type RouteContext = { params: Promise<{ orderId: string }> };

/**
 * POST /api/orders/:orderId/submit-bank-transfer
 *
 * Submits proof of bank transfer payment. Transitions the order from
 * DRAFT/AWAITING_PAYMENT → PAID directly (no verification gate).
 *
 * Files are transferred from staging to permanent storage.
 * Admin can optionally verify the payment later for record keeping.
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

		// Verify eligibility: owns the order, correct status
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

		// Transfer files from staging → permanent bucket
		const files = order.files || [];
		const transferMap = await transferOrderFiles(
			files.map((f: { stagingKey: string }) => ({ stagingKey: f.stagingKey })),
		);

		// Update files with permanent keys
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

		// Transition directly to PAID
		const updated = await payload.update({
			collection: "orders",
			id: orderId,
			data: {
				status: "PAID",
				bankTransferProofKey: proofKey,
				paymentMethod: "BANK_TRANSFER",
				bankTransferVerified: false,
				files: updatedFiles,
			},
		});

		// Notify admin via Discord so they can optionally verify the payment
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

		// Check if there are any active timeslots available
		let hasTimeslots = false;
		try {
			const timeslots = await payload.find({
				collection: "timeslots",
				where: { isActive: { equals: true } },
				limit: 1,
			});
			hasTimeslots = timeslots.totalDocs > 0;
		} catch {
			// Default to false if check fails
		}

		// Send confirmation email to the customer
		try {
			await sendBankTransferReceivedEmail({
				to: customer.email,
				customerName: customer.name,
				orderNumber: updated.orderNumber || "",
				files: order.files || [],
				pricing: order.pricing,
				hasTimeslots,
			});
		} catch (emailError) {
			console.error("Failed to send bank transfer email:", emailError);
		}

		return NextResponse.json({
			success: true,
			order: {
				id: updated.id,
				orderNumber: updated.orderNumber,
				status: updated.status,
			},
			message:
				"Bank transfer proof submitted. You can now select a pickup timeslot.",
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
