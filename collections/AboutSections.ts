import type { CollectionConfig } from "payload";

export const AboutSections: CollectionConfig = {
	slug: "about-sections",
	orderable: true,
	admin: {
		useAsTitle: "title",
		defaultColumns: ["title"],
		description:
			"Content sections displayed on the homepage About area. Drag to reorder. Use the rich text editor to add headings, text, and images.",
	},
	fields: [
		{
			name: "title",
			type: "text",
			required: true,
			admin: {
				description:
					"A short label for this section (used in the admin list only, not displayed on the site).",
			},
		},
		{
			name: "content",
			type: "richText",
			required: true,
			admin: {
				description:
					"The content for this section. Use headings, paragraphs, bold/italic text, and upload images directly.",
			},
		},
	],
};
