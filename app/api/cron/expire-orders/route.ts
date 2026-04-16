import { type NextRequest, NextResponse } from "next/server";
import { getPayloadClient } from "../../../../lib/payload";
import { cleanupStagingFiles } from "../../../../lib/r2";

/**
 * POST /api/cron/expire-orders
 *
 * Cron job endpoint that expires stale orders.
 * Should be called periodically (e.g. every hour via Vercel Cron or GitHub Actions).
 *
 * Transitions orders in DRAFT / AWAITING_PAYMENT
 * to EXPIRED when their `expiresAt` timestamp has passed.
 *
 * Cleans up associated staging bucket files.
 *
 * Protected by CRON_SECRET header — not accessible to end users.
 */
export async function POST(request: NextRequest) {
	// Verify cron secret
	const authHeader = request.headers.get("authorization");
	const expectedSecret = process.env.CRON_SECRET;

	if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
		return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
	}

	try {
		const payload = await getPayloadClient();
		const now = new Date().toISOString();

		// Find orders that should be expired
		const expiredOrders = await payload.find({
			collection: "orders",
			where: {
				status: {
					in: ["DRAFT", "AWAITING_PAYMENT"],
				},
				expiresAt: {
					less_than: now,
				},
			},
			limit: 100, // process in batches
		});

		let expiredCount = 0;
		let cleanupErrors = 0;

		for (const order of expiredOrders.docs) {
			try {
				// Clean up staging files
				const files = order.files || [];
				if (files.length > 0) {
					try {
						await cleanupStagingFiles(
							files.map((f: { stagingKey: string }) => ({
								stagingKey: f.stagingKey,
							})),
						);
					} catch (cleanupError) {
						console.error(
							`Failed to clean up staging files for order ${order.orderNumber}:`,
							cleanupError,
						);
						cleanupErrors++;
					}
				}

				// Transition to EXPIRED
				await payload.update({
					collection: "orders",
					id: order.id,
					data: { status: "EXPIRED" },
				});

				expiredCount++;
				console.log(`Expired order: ${order.orderNumber}`);
			} catch (error) {
				console.error(`Failed to expire order ${order.orderNumber}:`, error);
			}
		}

		return NextResponse.json({
			success: true,
			expired: expiredCount,
			total: expiredOrders.totalDocs,
			cleanupErrors,
			message: `Expired ${expiredCount} of ${expiredOrders.totalDocs} stale orders.`,
		});
	} catch (error) {
		console.error("Error in expire-orders cron:", error);
		return NextResponse.json(
			{ error: "Failed to process expired orders." },
			{ status: 500 },
		);
	}
}
