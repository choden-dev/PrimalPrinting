import type { CollectionConfig } from "payload";

export const Media: CollectionConfig = {
	slug: "media",
	upload: {
		mimeTypes: ["image/*"],
	},
	admin: {
		useAsTitle: "alt",
		description: "Images and media files for use in content.",
	},
	fields: [
		{
			name: "alt",
			type: "text",
			required: true,
			admin: {
				description: "Descriptive alt text for accessibility.",
			},
		},
	],
};
