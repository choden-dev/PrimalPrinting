import { type NextRequest, NextResponse } from "next/server";
import { sendTimeslotDeletedEmail } from "../../../../../../lib/email";
import { getPayloadClient } from "../../../../../../lib/payload";

export const runtime = "nodejs";
// Notifying many customers by email can take a little while.
export const maxDuration = 60;

interface OrderFileShape {
	fileName: string;
	pageCount: number;
	copies: number;
	colorMode: string;
	paperSize: string;
	doubleSided: boolean;
}

interface PricingShape {
	subtotal: number;
	tax: number;
	total: number;
}

/**
 * GET /api/admin/timeslots/[id]/delete
 *
 * Admin-only preview endpoint. Returns how many orders are booked into this
 * timeslot so the delete confirmation UI can tell the admin how many customers
 * will be notified, plus a human-readable label for the slot.
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await params;
		const payload = await getPayloadClient();

		const { user } = await payload.auth({ headers: request.headers });
		if (!user) {
			return NextResponse.json(
				{ error: "Admin authentication required." },
				{ status: 401 },
			);
		}

		const timeslot = await payload
			.findByID({ collection: "timeslots", id })
			.catch(() => null);

		if (!timeslot) {
			return NextResponse.json(
				{ error: "Timeslot not found." },
				{ status: 404 },
			);
		}

		const { totalDocs } = await payload.find({
			collection: "orders",
			where: { pickupTimeslot: { equals: id } },
			limit: 0,
			depth: 0,
		});

		return NextResponse.json({
			affectedOrders: totalDocs,
			label:
				(timeslot as { label?: string }).label ||
				`${(timeslot as { date?: string }).date ?? ""} ${
					(timeslot as { startTime?: string }).startTime ?? ""
				}`.trim(),
		});
	} catch (error) {
		console.error("Error loading timeslot delete preview:", error);
		return NextResponse.json(
			{ error: "Failed to load timeslot details." },
			{ status: 500 },
		);
	}
}

/**
 * POST /api/admin/timeslots/[id]/delete
 *
 * Admin-only endpoint that deletes a timeslot and notifies every customer with
 * an order booked into it. The admin supplies a personalised message (shown in
 * the email as "A note from us"). Each affected order has its pickupTimeslot
 * reference cleared so the customer can select a new slot.
 *
 * Body: `{ "message"?: string }`
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await params;
		const payload = await getPayloadClient();

		const { user } = await payload.auth({ headers: request.headers });
		if (!user) {
			return NextResponse.json(
				{ error: "Admin authentication required." },
				{ status: 401 },
			);
		}

		const body = (await request.json().catch(() => ({}))) as {
			message?: string;
		};
		const customMessage = body.message?.trim() || undefined;

		// Confirm the timeslot exists before doing any work.
		const timeslot = await payload
			.findByID({ collection: "timeslots", id })
			.catch(() => null);
		if (!timeslot) {
			return NextResponse.json(
				{ error: "Timeslot not found." },
				{ status: 404 },
			);
		}

		// Find all orders booked into this timeslot (populate the customer).
		const { docs: orders } = await payload.find({
			collection: "orders",
			where: { pickupTimeslot: { equals: id } },
			depth: 1,
			limit: 0,
		});

		let notified = 0;

		// Clear each order's reference and email the customer.
		const results = await Promise.allSettled(
			orders.map(async (order) => {
				try {
					await payload.update({
						collection: "orders",
						id: order.id,
						data: { pickupTimeslot: null },
					});
				} catch (error) {
					console.error(
						`[Timeslots] Failed to clear pickupTimeslot on order ${order.orderNumber}:`,
						error,
					);
				}

				const customer = order.customer as {
					email?: string;
					name?: string;
				} | null;
				if (!customer?.email) return;

				await sendTimeslotDeletedEmail({
					to: customer.email,
					customerName: customer.name || "Customer",
					orderNumber: order.orderNumber,
					files: (order.files || []) as OrderFileShape[],
					pricing: order.pricing as PricingShape | undefined,
					customMessage,
				});
				notified += 1;
			}),
		);

		for (const result of results) {
			if (result.status === "rejected") {
				console.error(
					"[Timeslots] Failed to notify a customer of deletion:",
					result.reason,
				);
			}
		}

		// Finally, delete the timeslot itself.
		await payload.delete({ collection: "timeslots", id });

		console.log(
			`[Timeslots] Deleted timeslot ${id}; notified ${notified}/${orders.length} order(s).`,
		);

		return NextResponse.json({
			success: true,
			deleted: true,
			affectedOrders: orders.length,
			notified,
		});
	} catch (error) {
		console.error("Error deleting timeslot:", error);
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to delete timeslot.",
			},
			{ status: 500 },
		);
	}
}
