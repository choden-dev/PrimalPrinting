import type { CollectionAfterChangeHook, CollectionConfig } from "payload";
import { generateTimeslotsForSchedule } from "../lib/scheduleGenerator";

/**
 * Schedules collection – Calendly-style recurring pickup schedules.
 *
 * Each schedule defines a weekly pattern of available pickup windows that
 * repeats from startDate to endDate. When a schedule is created or updated,
 * individual Timeslot documents are automatically generated/synced.
 *
 * Schedules are linked to a PickupInstructionProfile so every generated
 * timeslot inherits the associated pickup instructions.
 */

// ── afterChange hook: generate timeslots when schedule changes ───────────
const syncTimeslots: CollectionAfterChangeHook = async ({ doc, operation }) => {
	// Fire-and-forget so the admin UI isn't blocked
	void (async () => {
		try {
			const result = await generateTimeslotsForSchedule(doc);
			console.log(
				`[Schedules] ${operation === "create" ? "Created" : "Updated"} schedule "${doc.name}": ` +
					`${result.created} created, ${result.deactivated} deactivated, ${result.unchanged} unchanged`,
			);
		} catch (error) {
			console.error(
				`[Schedules] Failed to generate timeslots for schedule "${doc.name}" (${doc.id}):`,
				error,
			);
		}
	})();

	return doc;
};

// ── Time format validator ────────────────────────────────────────────────
const validateTimeFormat = (value: string | null | undefined) => {
	if (!value) return "Time is required.";
	if (!/^\d{2}:\d{2}$/.test(value))
		return 'Must be in HH:MM format (e.g. "09:00").';
	return true;
};

export const Schedules: CollectionConfig = {
	slug: "schedules",
	admin: {
		useAsTitle: "name",
		defaultColumns: [
			"name",
			"startDate",
			"endDate",
			"pickupInstructionProfile",
			"isActive",
		],
		description:
			"Recurring pickup schedules. Define a weekly pattern and timeslots are auto-generated.",
	},
	access: {
		read: ({ req }) => Boolean(req.user),
		create: ({ req }) => Boolean(req.user),
		update: ({ req }) => Boolean(req.user),
		delete: ({ req }) => Boolean(req.user),
	},
	hooks: {
		afterChange: [syncTimeslots],
	},
	fields: [
		{
			name: "name",
			type: "text",
			required: true,
			admin: {
				description:
					'A descriptive name for this schedule (e.g. "Semester 1 Locker Pickups").',
			},
		},
		{
			name: "pickupInstructionProfile",
			type: "relationship",
			relationTo: "pickup-instruction-profiles",
			admin: {
				description:
					"Pickup instructions shown to customers who book a timeslot from this schedule.",
			},
		},
		{
			name: "startDate",
			type: "text",
			required: true,
			validate: (value: string | null | undefined) => {
				if (!value) return "Start date is required.";
				if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
					return "Date must be in YYYY-MM-DD format (e.g. 2026-05-01).";
				return true;
			},
			admin: {
				placeholder: "2026-05-01",
				description:
					"First day this schedule is active (YYYY-MM-DD, inclusive).",
			},
		},
		{
			name: "endDate",
			type: "text",
			required: true,
			validate: (value: string | null | undefined) => {
				if (!value) return "End date is required.";
				if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
					return "Date must be in YYYY-MM-DD format (e.g. 2026-06-30).";
				return true;
			},
			admin: {
				placeholder: "2026-06-30",
				description:
					"Last day this schedule generates timeslots (YYYY-MM-DD, inclusive).",
			},
		},
		{
			name: "minimumNoticeHours",
			type: "number",
			defaultValue: 24,
			min: 0,
			admin: {
				description:
					"Minimum hours of notice before a slot can be booked. Overrides the global default. Set to 0 for last-minute bookings.",
			},
		},
		{
			name: "weeklySlots",
			type: "array",
			required: true,
			minRows: 1,
			admin: {
				description:
					"The recurring weekly pattern. Add one entry per time window per day.",
			},
			fields: [
				{
					name: "dayOfWeek",
					type: "select",
					required: true,
					options: [
						{ label: "Monday", value: "monday" },
						{ label: "Tuesday", value: "tuesday" },
						{ label: "Wednesday", value: "wednesday" },
						{ label: "Thursday", value: "thursday" },
						{ label: "Friday", value: "friday" },
						{ label: "Saturday", value: "saturday" },
						{ label: "Sunday", value: "sunday" },
					],
					admin: {
						description: "Day of the week for this time window.",
					},
				},
				{
					name: "startTime",
					type: "text",
					required: true,
					admin: {
						description: 'Start time in 24-hour format (e.g. "09:00").',
					},
					validate: validateTimeFormat,
				},
				{
					name: "endTime",
					type: "text",
					required: true,
					admin: {
						description: 'End time in 24-hour format (e.g. "17:00").',
					},
					validate: validateTimeFormat,
				},
				{
					name: "slotDurationMinutes",
					type: "number",
					min: 5,
					admin: {
						description:
							"Split the time range into slots of this duration (minutes). E.g. set to 60 to create hourly slots from 09:00–17:00. Leave blank to create a single slot for the entire range.",
					},
				},
				{
					name: "breakMinutes",
					type: "number",
					min: 0,
					defaultValue: 0,
					admin: {
						description:
							"Minutes of break between each generated slot. Only applies when slot duration is set.",
						condition: (_data, siblingData) =>
							Boolean(siblingData?.slotDurationMinutes),
					},
				},
				{
					name: "maxCapacity",
					type: "number",
					min: 1,
					admin: {
						description:
							"Maximum number of orders that can book each slot. Leave blank for unlimited.",
					},
				},
			],
		},
		{
			name: "isActive",
			type: "checkbox",
			defaultValue: true,
			admin: {
				description:
					"Uncheck to stop generating new timeslots without deleting the schedule.",
			},
		},
	],
	timestamps: true,
};
