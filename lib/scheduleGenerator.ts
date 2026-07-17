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

	// Advance to the first occurrence of dayOfWeek (UTC avoids TZ issues)
	while (current.getUTCDay() !== dayOfWeek && current <= end) {
		current.setUTCDate(current.getUTCDate() + 1);
	}

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

/**
 * IANA timezone the shop operates in. Timeslot `date` (YYYY-MM-DD) and
 * `startTime`/`endTime` (HH:MM) are stored as bare wall-clock strings with no
 * timezone, so they must be interpreted in the shop's local timezone to be
 * turned into real instants. Defaults to Pacific/Auckland — keep this in sync
 * with the SHOP_TIMEZONE default in container-worker.js and .env.local.
 */
export const SHOP_TIMEZONE = process.env.SHOP_TIMEZONE || "Pacific/Auckland";

/**
 * Compute the UTC offset (in minutes) of a given IANA timezone at a specific
 * instant, e.g. +780 for Pacific/Auckland during NZDT. Positive means the zone
 * is ahead of UTC. Uses Intl so DST is handled automatically for the date.
 */
function tzOffsetMinutes(instant: Date, timeZone: string): number {
	// Format the instant as wall-clock parts in the target timezone, then read
	// those parts back as if they were UTC. The difference between that pseudo-UTC
	// value and the real instant is the zone's offset at that moment.
	const dtf = new Intl.DateTimeFormat("en-US", {
		timeZone,
		hour12: false,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
	const parts = dtf.formatToParts(instant);
	const map: Record<string, number> = {};
	for (const p of parts) {
		if (p.type !== "literal") map[p.type] = Number(p.value);
	}
	// Intl may emit hour "24" at midnight — normalise to 0.
	const hour = map.hour === 24 ? 0 : map.hour;
	const asUTC = Date.UTC(
		map.year,
		map.month - 1,
		map.day,
		hour,
		map.minute,
		map.second,
	);
	return (asUTC - instant.getTime()) / 60000;
}

/**
 * Convert a timeslot's wall-clock `date` (YYYY-MM-DD) and `time` (HH:MM),
 * interpreted in `timeZone`, into the correct absolute Date (instant).
 *
 * This is timezone-safe: the same slot resolves to the same instant regardless
 * of the server's own timezone, so notice-period math is correct in production
 * (where the server typically runs in UTC) as well as locally. DST transitions
 * are handled by resolving the offset for that specific wall-clock moment.
 */
export function slotInstant(
	date: string,
	time: string,
	timeZone: string = SHOP_TIMEZONE,
): Date {
	const dateStr = date.includes("T") ? date.split("T")[0] : date;
	const [year, month, day] = dateStr.split("-").map(Number);
	const [hour, minute] = (time || "00:00").split(":").map(Number);

	// First guess: treat the wall-clock time as if it were UTC.
	const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
	// The offset near that instant tells us how far to shift to get the real
	// instant. We resolve the offset twice to correctly handle the rare case
	// where the guess lands on the far side of a DST boundary.
	const offset1 = tzOffsetMinutes(new Date(utcGuess), timeZone);
	const candidate = utcGuess - offset1 * 60000;
	const offset2 = tzOffsetMinutes(new Date(candidate), timeZone);
	const finalMs = offset2 === offset1 ? candidate : utcGuess - offset2 * 60000;
	return new Date(finalMs);
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
