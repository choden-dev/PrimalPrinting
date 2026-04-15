import type { GlobalConfig } from "payload";

export const ContactInfo: GlobalConfig = {
	slug: "contact-info",
	admin: {
		description:
			"Site-wide contact information displayed on the contact page, footer, and order confirmation.",
	},
	fields: [
		{
			name: "email",
			type: "email",
			required: true,
			admin: {
				description: "The primary contact email address.",
			},
		},
		{
			name: "phone",
			type: "text",
			required: true,
			admin: {
				description: "The primary contact phone number.",
			},
		},
	],
};
