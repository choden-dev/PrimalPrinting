import type { CollectionConfig } from "payload";

/**
 * PickupInstructionProfiles – reusable pickup instruction templates.
 *
 * Each profile represents a pickup method (e.g. "Locker Pickup",
 * "In-Person Pickup") with rich-text instructions that are shown to
 * customers on the order confirmation page and in confirmation emails.
 *
 * Profiles are linked to Schedules so every timeslot generated from a
 * schedule inherits the associated pickup instructions.
 */
export const PickupInstructionProfiles: CollectionConfig = {
	slug: "pickup-instruction-profiles",
	admin: {
		useAsTitle: "name",
		defaultColumns: ["name", "shortSummary", "updatedAt"],
		description:
			"Reusable pickup instruction profiles. Link these to schedules so customers see pickup instructions when they select a timeslot.",
	},
	access: {
		// Public read — needed so the frontend can display instructions
		read: () => true,
		create: ({ req }) => Boolean(req.user),
		update: ({ req }) => Boolean(req.user),
		delete: ({ req }) => Boolean(req.user),
	},
	fields: [
		{
			name: "name",
			type: "text",
			required: true,
			admin: {
				description:
					'Friendly name for this profile (e.g. "Locker Pickup", "In-Person Pickup").',
			},
		},
		{
			name: "shortSummary",
			type: "text",
			admin: {
				description:
					'One-line summary for emails (e.g. "Collect from locker #4, ground floor"). Keep it brief.',
			},
		},
		{
			name: "instructions",
			type: "blocks",
			required: true,
			admin: {
				description:
					"Pickup instructions shown to customers on the confirmation page. Use rich text blocks to compose the content.",
			},
			blocks: [
				{
					slug: "richText",
					labels: {
						singular: "Rich Text",
						plural: "Rich Text Blocks",
					},
					fields: [
						{
							name: "content",
							type: "richText",
							required: true,
						},
					],
				},
			],
		},
	],
	timestamps: true,
};
