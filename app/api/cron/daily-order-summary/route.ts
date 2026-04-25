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
		const totalRevenueCents = orders.reduce(
			(sum, o) => sum + ((o.pricing as { total?: number })?.total || 0),
			0,
		);
		const pickupSelected = orders.filter((o) => o.pickupTimeslot).length;
		const awaitingPickup = totalOrders - pickupSelected;

		await notifyDailyOrderSummary({
			totalOrders,
			totalRevenueCents,
			awaitingPickup,
			pickupSelected,
		});

		return NextResponse.json({
			success: true,
			totalOrders,
			totalRevenueCents,
			awaitingPickup,
			pickupSelected,
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
