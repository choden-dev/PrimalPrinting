import { getPayloadClient } from "./payload";

/**
 * Schedule generator — creates timeslot documents from a recurring schedule.
 *
 * Given a schedule definition with weekly slot patterns, generates individual
 * timeslot documents for every matching day between startDate and endDate.
 *
 * Rules:
 * - Existing timeslots linked to this schedule that have orders booked are
 *   never deleted or modified.
 * - Timeslots that no longer match the schedule pattern (and have no orders)
 *   are deactivated (isActive = false).
 * - New timeslots are created for dates that don't already have a matching slot.
 */

// ── Types ────────────────────────────────────────────────────────────────

interface WeeklySlot {
	dayOfWeek:
		| "monday"
		| "tuesday"
		| "wednesday"
		| "thursday"
		| "friday"
		| "saturday"
		| "sunday";
	startTime: string; // HH:MM
	endTime: string; // HH:MM
	slotDurationMinutes?: number | null;
	breakMinutes?: number | null;
	maxCapacity?: number | null;
}

export interface ScheduleDoc {
	id: string;
	name: string;
	startDate: string; // ISO date
	endDate: string; // ISO date
	weeklySlots: WeeklySlot[];
	pickupInstructionProfile?: string | { id: string } | null;
	minimumNoticeHours?: number | null;
	isActive: boolean;
}

const DAY_MAP: Record<string, number> = {
	sunday: 0,
	monday: 1,
	tuesday: 2,
	wednesday: 3,
	thursday: 4,
	friday: 5,
	saturday: 6,
};

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Parse a date string (ISO or YYYY-MM-DD) into a timezone-safe
 * { year, month, day } object. Strips any time/timezone portion
 * so we always work with the calendar date as intended.
 */
function parseDateOnly(s: string): {
	year: number;
	month: number;
	day: number;
} {
	const dateStr = s.includes("T") ? s.split("T")[0] : s;
	const [year, month, day] = dateStr.split("-").map(Number);
	return { year, month, day };
}

/**
 * Convert a { year, month, day } into a noon-UTC Date.
 * Using noon avoids any DST edge cases when doing day-of-week math.
 */
function toNoonUTC(d: { year: number; month: number; day: number }): Date {
	return new Date(Date.UTC(d.year, d.month - 1, d.day, 12, 0, 0));
}

/** Format as YYYY-MM-DD from a noon-UTC Date. */
function toDateString(d: Date): string {
	const year = d.getUTCFullYear();
	const month = (d.getUTCMonth() + 1).toString().padStart(2, "0");
	const day = d.getUTCDate().toString().padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/** Get all YYYY-MM-DD strings between start and end (inclusive) that match a day-of-week. */
function getDatesForDay(start: Date, end: Date, dayOfWeek: number): Date[] {
	const dates: Date[] = [];
	const current = new Date(start);

	// Advance to the first occurrence of dayOfWeek (using UTC to avoid TZ issues)
	while (current.getUTCDay() !== dayOfWeek && current <= end) {
		current.setUTCDate(current.getUTCDate() + 1);
	}

	// Collect every 7 days
	while (current <= end) {
		dates.push(new Date(current));
		current.setUTCDate(current.getUTCDate() + 7);
	}

	return dates;
}

/** Build a unique key for a timeslot (date + startTime + endTime). */
function slotKey(date: string, startTime: string, endTime: string): string {
	return `${date}|${startTime}|${endTime}`;
}

/** Parse "HH:MM" into total minutes since midnight. */
function parseTime(t: string): number {
	const [h, m] = t.split(":").map(Number);
	return h * 60 + m;
}

/** Format total minutes since midnight back to "HH:MM". */
function formatTime(mins: number): string {
	const h = Math.floor(mins / 60)
		.toString()
		.padStart(2, "0");
	const m = (mins % 60).toString().padStart(2, "0");
	return `${h}:${m}`;
}

/**
 * Expand a weekly slot into individual sub-slots.
 *
 * If `slotDurationMinutes` is set, splits the start–end range into
 * multiple slots of that duration with optional breaks between them.
 * Otherwise returns a single slot spanning the full range.
 */
function expandWeeklySlot(
	ws: WeeklySlot,
): { startTime: string; endTime: string; maxCapacity?: number | null }[] {
	const duration = ws.slotDurationMinutes;

	// No duration set — single slot for the entire range
	if (!duration || duration <= 0) {
		return [
			{
				startTime: ws.startTime,
				endTime: ws.endTime,
				maxCapacity: ws.maxCapacity,
			},
		];
	}

	const rangeStart = parseTime(ws.startTime);
	const rangeEnd = parseTime(ws.endTime);
	const breakMins =
		ws.breakMinutes && ws.breakMinutes > 0 ? ws.breakMinutes : 0;

	const slots: {
		startTime: string;
		endTime: string;
		maxCapacity?: number | null;
	}[] = [];
	let cursor = rangeStart;

	while (cursor + duration <= rangeEnd) {
		slots.push({
			startTime: formatTime(cursor),
			endTime: formatTime(cursor + duration),
			maxCapacity: ws.maxCapacity,
		});
		cursor += duration + breakMins;
	}

	return slots;
}

// ── Main generator ───────────────────────────────────────────────────────

/**
 * Generate (or sync) timeslots for a given schedule.
 *
 * @returns Summary of what was created, deactivated, and skipped.
 */
export async function generateTimeslotsForSchedule(
	schedule: ScheduleDoc,
): Promise<{
	created: number;
	deactivated: number;
	unchanged: number;
}> {
	const payload = await getPayloadClient();

	// Parse dates as timezone-safe noon-UTC values to avoid off-by-one errors
	const start = toNoonUTC(parseDateOnly(schedule.startDate));
	const end = toNoonUTC(parseDateOnly(schedule.endDate));

	if (start > end) {
		throw new Error("Schedule startDate must be before endDate.");
	}

	const profileId =
		typeof schedule.pickupInstructionProfile === "object"
			? schedule.pickupInstructionProfile?.id
			: schedule.pickupInstructionProfile;

	// 1. Compute all desired slots from the weekly pattern
	const desiredSlots = new Map<
		string,
		{
			date: string;
			startTime: string;
			endTime: string;
			maxCapacity?: number | null;
		}
	>();

	for (const ws of schedule.weeklySlots) {
		const dayNum = DAY_MAP[ws.dayOfWeek];
		if (dayNum === undefined) continue;

		// Expand the weekly slot into individual sub-slots
		const subSlots = expandWeeklySlot(ws);

		const dates = getDatesForDay(start, end, dayNum);
		for (const d of dates) {
			const dateStr = toDateString(d);
			for (const sub of subSlots) {
				const key = slotKey(dateStr, sub.startTime, sub.endTime);
				desiredSlots.set(key, {
					date: dateStr,
					startTime: sub.startTime,
					endTime: sub.endTime,
					maxCapacity: sub.maxCapacity,
				});
			}
		}
	}

	// 2. Fetch all existing timeslots for this schedule
	const { docs: existingSlots } = await payload.find({
		collection: "timeslots",
		where: { schedule: { equals: schedule.id } },
		limit: 0, // no limit
	});

	// Index existing slots by key
	const existingByKey = new Map<string, (typeof existingSlots)[number]>();
	for (const slot of existingSlots) {
		const dateStr =
			typeof slot.date === "string" ? slot.date.split("T")[0] : "";
		const key = slotKey(dateStr, slot.startTime, slot.endTime);
		existingByKey.set(key, slot);
	}

	let created = 0;
	let deactivated = 0;
	let unchanged = 0;

	// 3. Create new slots that don't already exist
	const createPromises: Promise<unknown>[] = [];

	for (const [key, desired] of desiredSlots) {
		if (existingByKey.has(key)) {
			// Slot already exists — update maxCapacity and profile if needed
			const existing = existingByKey.get(key);
			if (!existing) continue;
			const needsUpdate =
				existing.maxCapacity !== desired.maxCapacity ||
				(existing.pickupInstructionProfile as string | undefined) !==
					profileId ||
				!existing.isActive;

			if (needsUpdate) {
				createPromises.push(
					payload.update({
						collection: "timeslots",
						id: existing.id,
						data: {
							maxCapacity: desired.maxCapacity ?? null,
							pickupInstructionProfile: profileId || null,
							isActive: true,
						},
					}),
				);
			}
			unchanged++;
			continue;
		}

		// Auto-generate label — use noon UTC to avoid timezone date shift
		const dateObj = toNoonUTC(parseDateOnly(desired.date));
		const label = `${dateObj.toLocaleDateString("en-NZ", {
			weekday: "short",
			day: "numeric",
			month: "short",
			timeZone: "UTC",
		})} ${desired.startTime} – ${desired.endTime}`;

		createPromises.push(
			payload.create({
				collection: "timeslots",
				data: {
					date: desired.date,
					startTime: desired.startTime,
					endTime: desired.endTime,
					label,
					isActive: schedule.isActive,
					schedule: schedule.id,
					pickupInstructionProfile: profileId || null,
					maxCapacity: desired.maxCapacity ?? null,
					bookedCount: 0,
				},
			}),
		);
		created++;
	}

	// 4. Deactivate existing slots that are no longer in the desired set
	//    (but only if they have no booked orders)
	for (const [key, existing] of existingByKey) {
		if (!desiredSlots.has(key) && existing.isActive) {
			const bookedCount =
				typeof existing.bookedCount === "number" ? existing.bookedCount : 0;

			if (bookedCount === 0) {
				createPromises.push(
					payload.update({
						collection: "timeslots",
						id: existing.id,
						data: { isActive: false },
					}),
				);
				deactivated++;
			}
			// If orders are booked, leave it active — admin can handle manually
		}
	}

	// Execute all operations
	await Promise.allSettled(createPromises);

	console.log(
		`[ScheduleGenerator] Schedule "${schedule.name}" (${schedule.id}): ` +
			`created=${created}, deactivated=${deactivated}, unchanged=${unchanged}`,
	);

	return { created, deactivated, unchanged };
}
