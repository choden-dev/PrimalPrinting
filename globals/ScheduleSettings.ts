import type { GlobalConfig } from "payload";

/**
 * ScheduleSettings – site-wide scheduling configuration.
 *
 * Provides default values used by the scheduling system when
 * individual schedules don't specify their own overrides.
 */
export const ScheduleSettings: GlobalConfig = {
	slug: "schedule-settings",
	admin: {
		description:
			"Default scheduling settings. Individual schedules can override these values.",
	},
	access: {
		read: () => true,
		update: ({ req }) => Boolean(req.user),
	},
	fields: [
		{
			name: "defaultMinimumNoticeHours",
			type: "number",
			required: true,
			defaultValue: 24,
			min: 0,
			admin: {
				description:
					"Default minimum hours of notice required before a customer can book a timeslot. Individual schedules can override this. Set to 0 to allow last-minute bookings.",
			},
		},
	],
};
