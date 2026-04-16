import type { CollectionConfig } from "payload";
import {
	cleanupStagingFiles,
	deleteFromPermanent,
	deleteFromStaging,
} from "../lib/r2";

// ── Order status enum ────────────────────────────────────────────────────
export const ORDER_STATUSES = [
	"DRAFT",
	"AWAITING_PAYMENT",
	"PAYMENT_PENDING_VERIFICATION",
	"PAID",
	"AWAITING_PICKUP",
	"PRINTED",
	"PICKED_UP",
	"EXPIRED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

// ── Valid state transitions ──────────────────────────────────────────────
const VALID_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
	DRAFT: ["AWAITING_PAYMENT", "EXPIRED"],
	AWAITING_PAYMENT: ["PAYMENT_PENDING_VERIFICATION", "PAID", "EXPIRED"],
	PAYMENT_PENDING_VERIFICATION: ["PAID", "EXPIRED"],
	PAID: ["AWAITING_PICKUP"],
	AWAITING_PICKUP: ["PRINTED"],
	PRINTED: ["PICKED_UP"],
	PICKED_UP: [],
	EXPIRED: [],
};

/**
 * Validate that a status transition is allowed.
 * Returns `true` if valid, or an error string if not.
 */
export function validateStatusTransition(
	from: OrderStatus,
	to: OrderStatus,
): true | string {
	if (from === to) return true; // no-op
	const allowed = VALID_TRANSITIONS[from];
	if (!allowed?.includes(to)) {
		return `Invalid status transition: ${from} → ${to}. Allowed: ${allowed?.join(", ") || "none"}.`;
	}
	return true;
}

// ── Helper: generate order number ────────────────────────────────────────
function generateOrderNumber(): string {
	const now = new Date();
	const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
	const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
	return `ORD-${datePart}-${randomPart}`;
}

// ── Collection definition ────────────────────────────────────────────────
export const Orders: CollectionConfig = {
	slug: "orders",
	admin: {
		useAsTitle: "orderNumber",
		defaultColumns: [
			"orderNumber",
			"customer",
			"status",
			"paymentMethod",
			"pricing.total",
			"createdAt",
		],
		description: "Customer print orders with full lifecycle tracking.",
		components: {
			edit: {
				beforeDocumentControls: [
					"@/components/admin/ApprovePaymentButton",
					"@/components/admin/MarkPickedUpButton",
					"@/components/admin/OrderFilesViewer",
				],
			},
		},
	},
	access: {
		// Admins see all; API routes handle per-customer filtering
		read: ({ req }) => {
			if (req.user) return true;
			return false;
		},
		create: ({ req }) => {
			if (req.user) return true;
			// Allow server-side creation from API routes
			return false;
		},
		update: ({ req }) => {
			if (req.user) return true;
			return false;
		},
		delete: ({ req }) => {
			if (req.user) return true;
			return false;
		},
	},
	hooks: {
		afterDelete: [
			// Clean up all associated R2 files when an order is deleted
			async ({ doc }) => {
				if (!doc) return;
				const files = doc.files || [];

				try {
					// Clean up staging files
					const stagingFiles = files
						.filter((f: { stagingKey?: string }) => f.stagingKey)
						.map((f: { stagingKey: string }) => ({
							stagingKey: f.stagingKey,
						}));
					if (stagingFiles.length > 0) {
						await cleanupStagingFiles(stagingFiles);
					}

					// Clean up permanent files (if transferred)
					for (const file of files) {
						const f = file as { permanentKey?: string };
						if (f.permanentKey) {
							try {
								await deleteFromPermanent(f.permanentKey);
							} catch {
								// Best effort — file may already be gone
							}
						}
					}

					// Clean up bank transfer proof (stored in staging bucket)
					if (doc.bankTransferProofKey) {
						try {
							await deleteFromStaging(doc.bankTransferProofKey as string);
						} catch {
							// Best effort
						}
					}
				} catch (error) {
					console.error(
						`Failed to clean up files for order ${doc.orderNumber}:`,
						error,
					);
				}
			},
		],
		beforeChange: [
			// Auto-generate orderNumber on create
			({ operation, data }) => {
				if (operation === "create" && data) {
					if (!data.orderNumber) {
						data.orderNumber = generateOrderNumber();
					}
				}
				return data;
			},
			// Validate status transitions on update
			({ operation, data, originalDoc }) => {
				if (operation === "update" && data?.status && originalDoc?.status) {
					const result = validateStatusTransition(
						originalDoc.status as OrderStatus,
						data.status as OrderStatus,
					);
					if (result !== true) {
						throw new Error(result);
					}

					// Set timestamps on specific transitions
					if (data.status === "PAID") {
						data.paidAt = new Date().toISOString();
						data.expiresAt = null; // clear expiry once paid
					}
					if (data.status === "PICKED_UP") {
						data.pickedUpAt = new Date().toISOString();
					}
				}
				return data;
			},
		],
	},
	fields: [
		// ── Identity ──────────────────────────────────────────────────
		{
			name: "orderNumber",
			type: "text",
			required: true,
			unique: true,
			index: true,
			admin: {
				readOnly: true,
				description: 'Auto-generated order number (e.g. "ORD-20260415-A3F8").',
			},
		},
		{
			name: "customer",
			type: "relationship",
			relationTo: "customers",
			required: true,
			index: true,
			admin: {
				description: "The customer who placed this order.",
			},
		},

		// ── Status & Payment ──────────────────────────────────────────
		{
			name: "status",
			type: "select",
			required: true,
			defaultValue: "DRAFT",
			options: ORDER_STATUSES.map((s) => ({
				label: s.replace(/_/g, " "),
				value: s,
			})),
			index: true,
			admin: {
				description: "Current lifecycle status of the order.",
			},
		},
		{
			name: "paymentMethod",
			type: "select",
			options: [
				{ label: "Stripe (Credit Card)", value: "STRIPE" },
				{ label: "Bank Transfer", value: "BANK_TRANSFER" },
			],
			admin: {
				description: "Payment method chosen by the customer.",
			},
		},
		{
			name: "stripePaymentId",
			type: "text",
			admin: {
				description:
					"Stripe PaymentIntent ID (populated after successful Stripe payment).",
				condition: (data) => data?.paymentMethod === "STRIPE",
			},
		},
		{
			name: "bankTransferProofKey",
			type: "text",
			admin: {
				description:
					"R2 object key for the downsized bank transfer proof screenshot.",
				condition: (data) => data?.paymentMethod === "BANK_TRANSFER",
			},
		},

		// ── Files ─────────────────────────────────────────────────────
		{
			name: "files",
			type: "array",
			required: true,
			minRows: 1,
			admin: {
				description: "Documents included in this order.",
			},
			fields: [
				{
					name: "fileName",
					type: "text",
					required: true,
					admin: { description: "Original file name." },
				},
				{
					name: "stagingKey",
					type: "text",
					required: true,
					admin: {
						description: "R2 object key in the staging bucket.",
					},
				},
				{
					name: "permanentKey",
					type: "text",
					admin: {
						description:
							"R2 object key in the permanent bucket (set when payment is confirmed).",
					},
				},
				{
					name: "pageCount",
					type: "number",
					required: true,
					min: 1,
					admin: { description: "Number of pages in the document." },
				},
				{
					name: "copies",
					type: "number",
					required: true,
					min: 1,
					defaultValue: 1,
					admin: { description: "Number of copies to print." },
				},
				{
					name: "colorMode",
					type: "select",
					required: true,
					options: [
						{ label: "Colour", value: "COLOR" },
						{ label: "Black & White", value: "BW" },
					],
					admin: { description: "Print in colour or black & white." },
				},
				{
					name: "paperSize",
					type: "select",
					required: true,
					options: [
						{ label: "A4", value: "A4" },
						{ label: "A3", value: "A3" },
						{ label: "A5", value: "A5" },
						{ label: "Letter", value: "LETTER" },
					],
					defaultValue: "A4",
					admin: { description: "Paper size for printing." },
				},
				{
					name: "doubleSided",
					type: "checkbox",
					defaultValue: false,
					admin: { description: "Print on both sides of the page." },
				},
				{
					name: "fileSize",
					type: "number",
					required: true,
					min: 0,
					admin: { description: "File size in bytes." },
				},
			],
		},

		// ── Pricing ───────────────────────────────────────────────────
		{
			name: "pricing",
			type: "group",
			admin: {
				description: "Calculated pricing in cents.",
			},
			fields: [
				{
					name: "subtotal",
					type: "number",
					required: true,
					min: 0,
					admin: { description: "Subtotal before discount and tax (cents)." },
				},
				{
					name: "discount",
					type: "number",
					required: true,
					min: 0,
					defaultValue: 0,
					admin: {
						description:
							"Bulk discount amount (cents). Applied when copies >= minimum threshold.",
					},
				},
				{
					name: "tax",
					type: "number",
					required: true,
					min: 0,
					admin: { description: "Tax amount (cents)." },
				},
				{
					name: "total",
					type: "number",
					required: true,
					min: 0,
					admin: { description: "Total after discount and tax (cents)." },
				},
			],
		},

		// ── Pickup ────────────────────────────────────────────────────
		{
			name: "pickupTimeslot",
			type: "relationship",
			relationTo: "timeslots",
			admin: {
				description: "Selected pickup timeslot (set after payment).",
			},
		},

		// ── Admin ─────────────────────────────────────────────────────
		{
			name: "adminNotes",
			type: "richText",
			admin: {
				description:
					"Internal notes visible only to admins. Not shown to customers.",
			},
		},

		// ── Timestamps ────────────────────────────────────────────────
		{
			name: "expiresAt",
			type: "date",
			admin: {
				description:
					"When this order will auto-expire. Set on AWAITING_PAYMENT, cleared on PAID.",
				date: { pickerAppearance: "dayAndTime" },
			},
		},
		{
			name: "paidAt",
			type: "date",
			admin: {
				readOnly: true,
				description: "Timestamp when payment was confirmed.",
				date: { pickerAppearance: "dayAndTime" },
			},
		},
		{
			name: "pickedUpAt",
			type: "date",
			admin: {
				readOnly: true,
				description: "Timestamp when the order was picked up.",
				date: { pickerAppearance: "dayAndTime" },
			},
		},
	],
	timestamps: true,
};
