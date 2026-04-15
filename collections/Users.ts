import type { CollectionConfig } from "payload";

export const Users: CollectionConfig = {
	slug: "users",
	auth: true,
	admin: {
		useAsTitle: "email",
		description:
			"Admin users who can manage content via the Payload dashboard.",
	},
	fields: [
		{
			name: "name",
			type: "text",
		},
	],
};
