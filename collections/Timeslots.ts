import type { CollectionAfterChangeHook, CollectionConfig } from "payload";
import { sendTimeslotChangedEmail } from "../lib/email";
import { getPayloadClient } from "../lib/payload";

/**
 * Timeslots collection – admin-defined pickup windows that customers can book.
 *
 * Each timeslot represents a date + time range during which orders can be
 * collected.  The admin creates these ahead of time; customers choose one
 * after their payment is confirmed.
 *
 * Relationship is one-to-many (one timeslot → many orders) with no limit.
 */

// ── afterChange hook: notify customers when timeslot dates change ────────
const notifyOnTimeslotChange: CollectionAfterChangeHook = async ({
	doc,
	previousDoc,
	operation,
}) => {
	// Only run on updates where a previous doc exists
	if (operation !== "update" || !previousDoc) return doc;

	const dateChanged = previousDoc.date !== doc.date;
	const startTimeChanged = previousDoc.startTime !== doc.startTime;
	const endTimeChanged = previousDoc.endTime !== doc.endTime;

	// Nothing relevant changed — skip
	if (!dateChanged && !startTimeChanged && !endTimeChanged) return doc;

	const previous = {
		date: (previousDoc.date as string) || "",
		startTime: previousDoc.startTime as string,
		endTime: previousDoc.endTime as string,
		label: (previousDoc.label as string) || "",
	};

	const updated = {
		date: (doc.date as string) || "",
		startTime: doc.startTime as string,
		endTime: doc.endTime as string,
		label: (doc.label as string) || "",
	};

	// Fire-and-forget so the admin UI isn't blocked
	void (async () => {
		try {
			const payload = await getPayloadClient();

			// Find all orders that reference this timeslot
			const { docs: orders } = await payload.find({
				collection: "orders",
				where: { pickupTimeslot: { equals: doc.id } },
				depth: 1, // populate the customer relationship
				limit: 0, // no limit — fetch all
			});

			if (orders.length === 0) return;

			// Send an email per order (each may belong to a different customer)
			await Promise.allSettled(
				orders.map((order) => {
					const customer = order.customer as {
						email?: string;
						name?: string;
					} | null;

					if (!customer?.email) return Promise.resolve();

					return sendTimeslotChangedEmail({
						to: customer.email,
						customerName: customer.name || "Customer",
						orderNumber: order.orderNumber,
						files: (order.files || []) as {
							fileName: string;
							pageCount: number;
							copies: number;
							colorMode: string;
							paperSize: string;
							doubleSided: boolean;
						}[],
						pricing: order.pricing as
							| { subtotal: number; tax: number; total: number }
							| undefined,
						previous,
						updated,
					});
				}),
			);

			console.log(
				`[Timeslots] Notified ${orders.length} order(s) about timeslot ${doc.id} change`,
			);
		} catch (error) {
			console.error(
				`[Timeslots] Failed to send timeslot-change emails for ${doc.id}:`,
				error,
			);
		}
	})();

	return doc;
};

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
	hooks: {
		afterChange: [notifyOnTimeslotChange],
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
			validate: (value: string | null | undefined) => {
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
			validate: (value: string | null | undefined) => {
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
