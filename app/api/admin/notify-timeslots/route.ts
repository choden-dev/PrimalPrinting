import { type NextRequest, NextResponse } from "next/server";
import { isPayloadAdmin } from "../../../../lib/auth";
import { sendTimeslotsAvailableEmail } from "../../../../lib/email";
import { getPayloadClient } from "../../../../lib/payload";

/**
 * POST /api/admin/notify-timeslots
 *
 * Admin-only endpoint to bulk-send "timeslots available" emails to all
 * customers who have PAID orders without a pickup timeslot selected.
 *
 * This is useful when new timeslots are created and customers who were
 * previously told to wait need to be notified.
 *
 * Returns a summary of how many customers were notified.
 */
export async function POST(request: NextRequest) {
	if (!(await isPayloadAdmin(request))) {
		return NextResponse.json(
			{ error: "Admin access required." },
			{ status: 403 },
		);
	}

	try {
		const payload = await getPayloadClient();

		// Verify there are actually active timeslots available
		const timeslots = await payload.find({
			collection: "timeslots",
			where: { isActive: { equals: true } },
			limit: 1,
		});

		if (timeslots.totalDocs === 0) {
			return NextResponse.json(
				{
					error:
						"No active timeslots available. Please create timeslots before notifying customers.",
				},
				{ status: 400 },
			);
		}

		// Find all PAID orders without a pickup timeslot
		const orders = await payload.find({
			collection: "orders",
			where: {
				and: [
					{ status: { equals: "PAID" } },
					{
						or: [
							{ pickupTimeslot: { exists: false } },
							{ pickupTimeslot: { equals: null } },
						],
					},
				],
			},
			limit: 500,
			depth: 1, // populate customer relationship
		});

		if (orders.docs.length === 0) {
			return NextResponse.json({
				success: true,
				message:
					"No customers need to be notified — all PAID orders already have timeslots.",
				notified: 0,
			});
		}

		// Group orders by customer email so each customer gets one email
		const customerMap = new Map<
			string,
			{
				email: string;
				name: string;
				orders: {
					orderNumber: string;
					files: NonNullable<(typeof orders.docs)[number]["files"]>;
				}[];
			}
		>();

		for (const order of orders.docs) {
			const customer =
				typeof order.customer === "object" ? order.customer : null;
			if (!customer?.email) continue;

			const existing = customerMap.get(customer.email);
			if (existing) {
				existing.orders.push({
					orderNumber: order.orderNumber || order.id,
					files: order.files || [],
				});
			} else {
				customerMap.set(customer.email, {
					email: customer.email,
					name: customer.name || "Customer",
					orders: [
						{
							orderNumber: order.orderNumber || order.id,
							files: order.files || [],
						},
					],
				});
			}
		}

		// Send emails to each customer
		const results: { email: string; success: boolean; error?: string }[] = [];

		for (const [email, data] of customerMap) {
			try {
				await sendTimeslotsAvailableEmail({
					to: data.email,
					customerName: data.name,
					orders: data.orders,
				});
				results.push({ email, success: true });
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : "Unknown error";
				console.error(
					`Failed to send timeslot notification to ${email}:`,
					error,
				);
				results.push({ email, success: false, error: errorMessage });
			}
		}

		const successCount = results.filter((r) => r.success).length;
		const failCount = results.filter((r) => !r.success).length;

		return NextResponse.json({
			success: true,
			message: `Notified ${successCount} customer${successCount !== 1 ? "s" : ""}${failCount > 0 ? ` (${failCount} failed)` : ""}.`,
			notified: successCount,
			failed: failCount,
			details: results,
		});
	} catch (error) {
		console.error("Error sending timeslot notifications:", error);
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to send notifications.",
			},
			{ status: 500 },
		);
	}
}
