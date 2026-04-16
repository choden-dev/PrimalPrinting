import { type NextRequest, NextResponse } from "next/server";
import { isPayloadAdmin } from "../../../../../lib/auth";
import { getPayloadClient } from "../../../../../lib/payload";
import { transferOrderFiles } from "../../../../../lib/r2";

type RouteContext = { params: Promise<{ orderId: string }> };

/**
 * POST /api/orders/:orderId/approve-payment
 *
 * Admin-only endpoint to approve a bank transfer payment.
 * Transitions: PAYMENT_PENDING_VERIFICATION → PAID
 * Triggers staging → permanent file transfer.
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

		if (order.status !== "PAYMENT_PENDING_VERIFICATION") {
			return NextResponse.json(
				{
					error: `Cannot approve payment for order in ${order.status} status. Expected PAYMENT_PENDING_VERIFICATION.`,
				},
				{ status: 400 },
			);
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

		// Transition to PAID
		const updated = await payload.update({
			collection: "orders",
			id: orderId,
			data: {
				status: "PAID",
				files: updatedFiles,
			},
		});

		return NextResponse.json({
			success: true,
			order: {
				id: updated.id,
				orderNumber: updated.orderNumber,
				status: updated.status,
				paidAt: updated.paidAt,
			},
			message: "Payment approved. Files transferred to permanent storage.",
		});
	} catch (error) {
		console.error("Error approving payment:", error);
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to approve payment.",
			},
			{ status: 500 },
		);
	}
}
