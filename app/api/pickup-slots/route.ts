import { type NextRequest, NextResponse } from "next/server";
import { getPayloadClient } from "../../../lib/payload";

/**
 * GET /api/pickup-slots — List available pickup timeslots.
 *
 * Returns only active timeslots with dates in the future that:
 * - Are past the minimum notice period
 * - Have available capacity (bookedCount < maxCapacity, or unlimited)
 *
 * No authentication required – customers need to see available
 * slots before selecting one.
 *
 * Query params:
 * - `limit`  (number, default 50, max 100) — page size
 * - `offset` (number, default 0) — number of slots to skip
 */
export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const limit = Math.min(
			100,
			Math.max(1, Number(searchParams.get("limit")) || 50),
		);
		const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

		const payload = await getPayloadClient();

		const now = new Date();
		const todayStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;

		// Fetch all active future timeslots (we filter capacity + notice in JS
		// because MongoDB can't easily express "maxCapacity is null OR
		// bookedCount < maxCapacity" combined with notice-hour math).
		const result = await payload.find({
			collection: "timeslots",
			where: {
				isActive: { equals: true },
				date: { greater_than_equal: todayStr },
			},
			sort: "date",
			limit: 0, // fetch all, then filter in JS
			depth: 1, // populate pickupInstructionProfile
		});

		// Resolve the minimum notice hours for each timeslot.
		// Priority: timeslot's schedule → global default → 24h fallback
		let globalNoticeHours = 24;
		try {
			const settings = await payload.findGlobal({
				slug: "schedule-settings",
			});
			if (
				settings?.defaultMinimumNoticeHours != null &&
				typeof settings.defaultMinimumNoticeHours === "number"
			) {
				globalNoticeHours = settings.defaultMinimumNoticeHours;
			}
		} catch {
			// Use default
		}

		// Cache schedule notice hours to avoid repeated lookups
		const scheduleNoticeCache = new Map<string, number>();

		const filtered: typeof result.docs = [];

		for (const slot of result.docs) {
			// 1. Check capacity
			const maxCap =
				typeof slot.maxCapacity === "number" ? slot.maxCapacity : null;
			const booked =
				typeof slot.bookedCount === "number" ? slot.bookedCount : 0;

			if (maxCap !== null && booked >= maxCap) {
				continue; // Slot is full
			}

			// 2. Check minimum notice period
			let noticeHours = globalNoticeHours;

			const scheduleId =
				typeof slot.schedule === "object" && slot.schedule
					? (slot.schedule as { id: string }).id
					: typeof slot.schedule === "string"
						? slot.schedule
						: null;

			if (scheduleId) {
				if (scheduleNoticeCache.has(scheduleId)) {
					noticeHours = scheduleNoticeCache.get(scheduleId) ?? noticeHours;
				} else {
					try {
						const schedule = await payload.findByID({
							collection: "schedules",
							id: scheduleId,
						});
						if (
							schedule?.minimumNoticeHours != null &&
							typeof schedule.minimumNoticeHours === "number"
						) {
							noticeHours = schedule.minimumNoticeHours;
						}
						scheduleNoticeCache.set(scheduleId, noticeHours);
					} catch {
						scheduleNoticeCache.set(scheduleId, noticeHours);
					}
				}
			}

			// Compute the slot's start datetime
			const slotDateStr =
				typeof slot.date === "string" ? slot.date.split("T")[0] : "";
			const slotStart = new Date(
				`${slotDateStr}T${slot.startTime || "00:00"}:00`,
			);
			const cutoff = new Date(now.getTime() + noticeHours * 60 * 60 * 1000);

			if (slotStart <= cutoff) {
				continue; // Too close — within notice period
			}

			filtered.push(slot);
		}

		// Apply offset-based pagination
		const total = filtered.length;
		const paginated = filtered.slice(offset, offset + limit);

		return NextResponse.json({
			success: true,
			total,
			limit,
			offset,
			hasMore: offset + limit < total,
			timeslots: paginated.map((slot) => {
				const maxCap =
					typeof slot.maxCapacity === "number" ? slot.maxCapacity : null;
				const booked =
					typeof slot.bookedCount === "number" ? slot.bookedCount : 0;

				// Extract pickup instruction profile info
				const profile =
					typeof slot.pickupInstructionProfile === "object" &&
					slot.pickupInstructionProfile
						? (slot.pickupInstructionProfile as {
								id: string;
								name: string;
								shortSummary?: string;
							})
						: null;

				return {
					id: slot.id,
					date: slot.date,
					startTime: slot.startTime,
					endTime: slot.endTime,
					label: slot.label,
					maxCapacity: maxCap,
					bookedCount: booked,
					availableSpots: maxCap !== null ? maxCap - booked : null,
					pickupInstructionProfile: profile
						? {
								id: profile.id,
								name: profile.name,
								shortSummary: profile.shortSummary || null,
							}
						: null,
				};
			}),
		});
	} catch (error) {
		console.error("Error fetching timeslots:", error);
		return NextResponse.json(
			{ error: "Failed to fetch timeslots." },
			{ status: 500 },
		);
	}
}
