import type { CollectionConfig } from "payload";

/**
 * Timeslots collection – admin-defined pickup windows that customers can book.
 *
 * Each timeslot represents a date + time range during which orders can be
 * collected.  The admin creates these ahead of time; customers choose one
 * after their payment is confirmed.
 *
 * Relationship is one-to-many (one timeslot → many orders) with no limit.
 */
export const Timeslots: CollectionConfig = {
	slug: "timeslots",
	admin: {
		useAsTitle: "label",
		defaultColumns: ["label", "date", "startTime", "endTime", "isActive"],
		description:
			"Pickup time windows. Create slots here so customers can choose when to collect their orders.",
	},
	access: {
		// Public read so customers can fetch available timeslots
		read: () => true,
		// Only admins can create/update/delete
		create: ({ req }) => Boolean(req.user),
		update: ({ req }) => Boolean(req.user),
		delete: ({ req }) => Boolean(req.user),
	},
	fields: [
		{
			name: "date",
			type: "date",
			required: true,
			admin: {
				date: {
					pickerAppearance: "dayOnly",
					displayFormat: "yyyy-MM-dd",
				},
				description: "The date this pickup slot is available.",
			},
		},
		{
			name: "startTime",
			type: "text",
			required: true,
			admin: {
				description: 'Start time in 24-hour format, e.g. "09:00".',
			},
			validate: (value) => {
				if (!value) return "Start time is required.";
				if (!/^\d{2}:\d{2}$/.test(value))
					return 'Must be in HH:MM format (e.g. "09:00").';
				return true;
			},
		},
		{
			name: "endTime",
			type: "text",
			required: true,
			admin: {
				description: 'End time in 24-hour format, e.g. "17:00".',
			},
			validate: (value) => {
				if (!value) return "End time is required.";
				if (!/^\d{2}:\d{2}$/.test(value))
					return 'Must be in HH:MM format (e.g. "17:00").';
				return true;
			},
		},
		{
			name: "label",
			type: "text",
			admin: {
				description:
					'Optional friendly name (e.g. "Morning Pickup"). Auto-generated from date + time if left blank.',
			},
			hooks: {
				beforeValidate: [
					({ value, data }) => {
						if (value) return value;
						// Auto-generate a label from date + times
						const date = data?.date
							? new Date(data.date).toLocaleDateString("en-NZ", {
									weekday: "short",
									day: "numeric",
									month: "short",
								})
							: "TBD";
						return `${date} ${data?.startTime || "??:??"} – ${data?.endTime || "??:??"}`;
					},
				],
			},
		},
		{
			name: "isActive",
			type: "checkbox",
			defaultValue: true,
			admin: {
				description:
					"Uncheck to hide this slot from customers without deleting it.",
			},
		},
	],
	timestamps: true,
};
