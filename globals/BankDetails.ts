import type { GlobalConfig } from "payload";

export const BankDetails: GlobalConfig = {
	slug: "bank-details",
	admin: {
		description:
			"Bank account details shown to customers when they select bank transfer as their payment method.",
	},
	fields: [
		{
			name: "accountName",
			type: "text",
			required: true,
			admin: {
				description: "Account holder name displayed to customers.",
			},
		},
		{
			name: "bankName",
			type: "text",
			required: true,
			admin: {
				description: 'Bank name (e.g. "ANZ", "Westpac").',
			},
		},
		{
			name: "accountNumber",
			type: "text",
			required: true,
			admin: {
				description: "Full account number for bank transfers.",
			},
		},
		{
			name: "instructions",
			type: "textarea",
			admin: {
				description:
					"Optional extra instructions shown to customers (e.g. branch info, reference format).",
			},
		},
	],
};
