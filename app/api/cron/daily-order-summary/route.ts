import { type NextRequest, NextResponse } from "next/server";
import { notifyDailyOrderSummary } from "../../../../lib/discord";
import { getPayloadClient } from "../../../../lib/payload";

/**
 * POST /api/cron/daily-order-summary
 *
 * Cron job that posts a daily rollup of paid orders to Discord.
 * Intended to run once per day (e.g. 18:00 UTC / morning NZT).
 *
 * Protected by CRON_SECRET header.
 */
export async function POST(request: NextRequest) {
	const authHeader = request.headers.get("authorization");
	const expectedSecret = process.env.CRON_SECRET;

	if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
		return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
	}

	try {
		const payload = await getPayloadClient();

		// Today's date range (UTC)
		const now = new Date();
		const startOfDay = new Date(now);
		startOfDay.setUTCHours(0, 0, 0, 0);

		const { docs: orders } = await payload.find({
			collection: "orders",
			where: {
				paidAt: {
					greater_than_equal: startOfDay.toISOString(),
					less_than_equal: now.toISOString(),
				},
			},
			limit: 0,
		});

		const totalOrders = orders.length;
		const needsPickupSelection = orders.filter(
			(o) => o.status === "PAID" && !o.pickupTimeslot,
		).length;
		const needsPrinting = orders.filter(
			(o) => o.status === "AWAITING_PICKUP",
		).length;
		const pendingVerification = orders.filter(
			(o) => o.status === "PENDING_VERIFICATION",
		).length;

		await notifyDailyOrderSummary({
			totalOrders,
			needsPickupSelection,
			needsPrinting,
			pendingVerification,
		});

		return NextResponse.json({
			success: true,
			totalOrders,
			needsPickupSelection,
			needsPrinting,
			pendingVerification,
			message: `Daily summary posted: ${totalOrders} order(s).`,
		});
	} catch (error) {
		console.error("Error in daily-order-summary cron:", error);
		return NextResponse.json(
			{ error: "Failed to generate daily summary." },
			{ status: 500 },
		);
	}
}
