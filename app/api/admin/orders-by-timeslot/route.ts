import { type NextRequest, NextResponse } from "next/server";
import { getPayloadClient } from "../../../../lib/payload";

/**
 * GET /api/admin/orders-by-timeslot
 *
 * Admin-only endpoint that returns timeslots with their orders pre-grouped,
 * replacing the N+1 query pattern where the client fetched each timeslot's
 * orders individually.
 *
 * Query params:
 * - `filter` ("upcoming" | "all", default "upcoming") — "upcoming" returns
 *   timeslots with dates from today through the next 7 days.
 *
 * Returns:
 * - `groups[]` — timeslots with their orders already attached
 * - Each group has `timeslot` and `orders[]`
 * - A synthetic "unassigned" group is prepended for PAID orders without a slot
 */
export async function GET(request: NextRequest) {
	try {
		const payload = await getPayloadClient();

		// Verify admin auth
		const { user } = await payload.auth({ headers: request.headers });
		if (!user) {
			return NextResponse.json(
				{ error: "Admin authentication required." },
				{ status: 401 },
			);
		}

		const { searchParams } = new URL(request.url);
		const filter = searchParams.get("filter") === "all" ? "all" : "upcoming";

		// ── 1. Fetch all active timeslots, filter by date in JS ──────────
		// The date field is stored as a plain text "YYYY-MM-DD" string.
		// We fetch all active timeslots and filter in JS to handle any
		// date strings that might contain a "T" suffix consistently.
		const allTimeslotResult = await payload.find({
			collection: "timeslots",
			where: { isActive: { equals: true } },
			sort: "date",
			limit: 0,
			pagination: false,
			depth: 0,
		});

		let timeslots = allTimeslotResult.docs;

		if (filter === "upcoming") {
			const now = new Date();
			const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
			const nextWeek = new Date();
			nextWeek.setDate(nextWeek.getDate() + 7);
			const nextWeekStr = `${nextWeek.getFullYear()}-${String(nextWeek.getMonth() + 1).padStart(2, "0")}-${String(nextWeek.getDate()).padStart(2, "0")}`;

			timeslots = timeslots.filter((slot) => {
				const d =
					typeof slot.date === "string"
						? slot.date.includes("T")
							? slot.date.split("T")[0]
							: slot.date
						: "";
				return d >= todayStr && d <= nextWeekStr;
			});
		}

		const timeslotIds = timeslots.map((t) => String(t.id));

		// ── 2. Fetch orders in two parallel queries ──────────────────────
		const [assignedResult, unassignedResult] = await Promise.all([
			// All orders assigned to any of the fetched timeslots
			payload.find({
				collection: "orders",
				where:
					timeslotIds.length > 0
						? { pickupTimeslot: { in: timeslotIds } }
						: { id: { equals: "__none__" } },
				sort: "-createdAt",
				limit: 0,
				pagination: false,
				depth: 1,
			}),
			// Paid orders with no timeslot selected
			payload.find({
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
				sort: "-createdAt",
				limit: 0,
				pagination: false,
				depth: 1,
			}),
		]);

		// ── 3. Group assigned orders by timeslot ID ──────────────────────
		type OrderDoc = (typeof assignedResult.docs)[number];
		const ordersBySlot = new Map<string, OrderDoc[]>();

		for (const order of assignedResult.docs) {
			const rawSlot = order.pickupTimeslot;
			const slotId = rawSlot
				? typeof rawSlot === "object"
					? String((rawSlot as { id: string | number }).id)
					: String(rawSlot)
				: null;

			if (slotId) {
				const list = ordersBySlot.get(slotId);
				if (list) {
					list.push(order);
				} else {
					ordersBySlot.set(slotId, [order]);
				}
			}
		}

		// ── 4. Build response ────────────────────────────────────────────
		interface OrderResponse {
			id: string | number;
			orderNumber: string;
			status: string;
			paymentMethod: string | null;
			bankTransferVerified: boolean | null;
			pricing: { total: number };
			files: {
				fileName: string;
				copies: number;
				colorMode?: string;
				stagingKey?: string;
				permanentKey?: string;
			}[];
			customer: { name: string; email: string } | string;
			pickedUpAt: string | null;
		}

		function mapOrder(order: OrderDoc): OrderResponse {
			return {
				id: order.id,
				orderNumber: order.orderNumber,
				status: order.status,
				paymentMethod: (order.paymentMethod as string) || null,
				bankTransferVerified: (order.bankTransferVerified as boolean) ?? null,
				pricing: order.pricing as { total: number },
				files: (order.files || []).map((f: Record<string, unknown>) => ({
					fileName: f.fileName as string,
					copies: f.copies as number,
					colorMode: (f.colorMode as string) || undefined,
					stagingKey: (f.stagingKey as string) || undefined,
					permanentKey: (f.permanentKey as string) || undefined,
				})),
				customer:
					typeof order.customer === "object" && order.customer
						? {
								name: (order.customer as { name?: string }).name || "—",
								email: (order.customer as { email?: string }).email || "—",
							}
						: String(order.customer),
				pickedUpAt: (order.pickedUpAt as string) || null,
			};
		}

		const groups: {
			timeslot: {
				id: string;
				date: string;
				startTime: string;
				endTime: string;
				label: string;
			};
			orders: OrderResponse[];
		}[] = [];

		// Unassigned group first
		if (unassignedResult.docs.length > 0) {
			groups.push({
				timeslot: {
					id: "unassigned",
					date: "",
					startTime: "",
					endTime: "",
					label: "⚠️ Paid — No Pickup Time Selected",
				},
				orders: unassignedResult.docs.map(mapOrder),
			});
		}

		// Timeslot groups (only include slots that have orders)
		for (const slot of timeslots) {
			const slotOrders = ordersBySlot.get(String(slot.id));
			if (slotOrders && slotOrders.length > 0) {
				groups.push({
					timeslot: {
						id: String(slot.id),
						date: slot.date as string,
						startTime: slot.startTime as string,
						endTime: slot.endTime as string,
						label: (slot.label as string) || "",
					},
					orders: slotOrders.map(mapOrder),
				});
			}
		}

		return NextResponse.json({ success: true, groups });
	} catch (error) {
		console.error("Error fetching orders by timeslot:", error);
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to fetch orders by timeslot.",
			},
			{ status: 500 },
		);
	}
}
