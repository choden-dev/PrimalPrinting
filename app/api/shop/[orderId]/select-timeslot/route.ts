import { type NextRequest, NextResponse } from "next/server";
import { pickupProfileToHtml, sendOrderConfirmationEmail } from "@/lib/email";
import { getAuthenticatedCustomer } from "../../../../../lib/auth";
import { notifyPickupSlotSelected } from "../../../../../lib/discord";
import { getPayloadClient } from "../../../../../lib/payload";

type RouteContext = { params: Promise<{ orderId: string }> };

/**
 * POST /api/orders/:orderId/select-timeslot
 *
 * Customer selects (or changes) a pickup timeslot.
 * - PAID → AWAITING_PICKUP (first selection)
 * - AWAITING_PICKUP → AWAITING_PICKUP (re-selection / change)
 *
 * Enforces capacity limits and includes pickup instructions in the response.
 * Triggers order confirmation email with pickup details and instructions.
 *
 * Body: `{ "timeslotId": "..." }`
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
		const { timeslotId } = body;

		if (!timeslotId) {
			return NextResponse.json(
				{ error: "timeslotId is required." },
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

		if (order.status !== "PAID" && order.status !== "AWAITING_PICKUP") {
			return NextResponse.json(
				{
					error: `Cannot select timeslot for order in ${order.status} status. Order must be PAID or AWAITING_PICKUP.`,
				},
				{ status: 400 },
			);
		}

		// Verify timeslot exists and is active
		const timeslot = await payload.findByID({
			collection: "timeslots",
			id: timeslotId,
			depth: 1, // populate pickupInstructionProfile
		});

		if (!timeslot?.isActive) {
			return NextResponse.json(
				{ error: "Selected timeslot is not available." },
				{ status: 400 },
			);
		}

		// ── Capacity check ───────────────────────────────────────────
		const maxCap =
			typeof timeslot.maxCapacity === "number" ? timeslot.maxCapacity : null;
		const currentBooked =
			typeof timeslot.bookedCount === "number" ? timeslot.bookedCount : 0;

		if (maxCap !== null && currentBooked >= maxCap) {
			return NextResponse.json(
				{ error: "This timeslot is fully booked. Please choose another." },
				{ status: 409 },
			);
		}

		const isChangingTimeslot = order.status === "AWAITING_PICKUP";
		const previousTimeslotId = isChangingTimeslot
			? typeof order.pickupTimeslot === "object" && order.pickupTimeslot
				? (order.pickupTimeslot as { id: string }).id
				: (order.pickupTimeslot as string | null)
			: null;

		// ── Update the order ─────────────────────────────────────────
		const updateData: Record<string, unknown> = {
			pickupTimeslot: timeslotId,
		};
		if (!isChangingTimeslot) {
			updateData.status = "AWAITING_PICKUP";
		}

		const updated = await payload.update({
			collection: "orders",
			id: orderId,
			data: updateData,
		});

		// ── Update booked counts ─────────────────────────────────────
		// Increment new timeslot's bookedCount
		await payload.update({
			collection: "timeslots",
			id: timeslotId,
			data: { bookedCount: currentBooked + 1 },
		});

		// Decrement old timeslot's bookedCount (if changing)
		if (
			isChangingTimeslot &&
			previousTimeslotId &&
			previousTimeslotId !== timeslotId
		) {
			try {
				const oldSlot = await payload.findByID({
					collection: "timeslots",
					id: previousTimeslotId,
				});
				if (oldSlot) {
					const oldBooked =
						typeof oldSlot.bookedCount === "number" ? oldSlot.bookedCount : 0;
					await payload.update({
						collection: "timeslots",
						id: previousTimeslotId,
						data: { bookedCount: Math.max(0, oldBooked - 1) },
					});
				}
			} catch (err) {
				console.error("Failed to decrement old timeslot bookedCount:", err);
			}
		}

		// ── Extract pickup instructions ──────────────────────────────
		const profile =
			typeof timeslot.pickupInstructionProfile === "object" &&
			timeslot.pickupInstructionProfile
				? (timeslot.pickupInstructionProfile as {
						id: string;
						name: string;
						shortSummary?: string;
						instructions?: unknown[];
					})
				: null;

		// Notify admin via Discord so they can prepare the order
		try {
			const formattedDate = timeslot.date
				? new Date(timeslot.date).toLocaleDateString("en-NZ", {
						weekday: "long",
						day: "numeric",
						month: "long",
						year: "numeric",
					})
				: "TBD";

			await notifyPickupSlotSelected({
				orderNumber: order.orderNumber || orderId,
				customerName: customer.name,
				customerEmail: customer.email,
				pickupDate: formattedDate,
				pickupTime: `${timeslot.startTime} – ${timeslot.endTime}`,
				pickupLabel: timeslot.label || "",
			});
		} catch (discordError) {
			console.error("Failed to send Discord notification:", discordError);
		}

		// Send confirmation email
		try {
			await sendOrderConfirmationEmail({
				to: customer.email,
				customerName: customer.name,
				orderNumber: order.orderNumber || "",
				files: order.files || [],
				pricing: order.pricing,
				timeslot: {
					date: timeslot.date || "",
					startTime: timeslot.startTime || "",
					endTime: timeslot.endTime || "",
					label: timeslot.label || "",
				},
				pickupInstructionsHtml: pickupProfileToHtml(
					timeslot.pickupInstructionProfile,
				),
			});
		} catch (emailError) {
			// Log but don't fail the request – order is already updated
			console.error("Failed to send confirmation email:", emailError);
		}

		return NextResponse.json({
			success: true,
			order: {
				id: updated.id,
				orderNumber: updated.orderNumber,
				status: updated.status,
				pickupTimeslot: timeslot,
			},
			pickupInstructionProfile: profile
				? {
						id: profile.id,
						name: profile.name,
						shortSummary: profile.shortSummary || null,
						instructions: profile.instructions || [],
					}
				: null,
			message: isChangingTimeslot
				? "Pickup timeslot updated. Confirmation email sent."
				: "Pickup timeslot confirmed. Confirmation email sent.",
		});
	} catch (error) {
		console.error("Error selecting timeslot:", error);
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to select timeslot.",
			},
			{ status: 500 },
		);
	}
}
