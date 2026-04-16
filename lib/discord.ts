/**
 * Discord webhook integration for sending admin notifications.
 *
 * Uses Discord's webhook API to post embedded messages when key order
 * events occur (e.g. bank transfer submitted, pickup slot selected).
 *
 * Set the DISCORD_WEBHOOK_URL environment variable to enable notifications.
 * If the variable is not set, notifications are silently skipped.
 */

// ── Types ────────────────────────────────────────────────────────────────

interface EmbedField {
	name: string;
	value: string;
	inline?: boolean;
}

interface DiscordEmbed {
	title: string;
	description?: string;
	color?: number;
	fields?: EmbedField[];
	timestamp?: string;
}

interface DiscordWebhookPayload {
	content?: string;
	embeds?: DiscordEmbed[];
}

// ── Colours (decimal) ────────────────────────────────────────────────────

const COLORS = {
	/** Orange – action required */
	WARNING: 0xffa500,
	/** Blue – informational */
	INFO: 0x3498db,
} as const;

// ── Core send helper ─────────────────────────────────────────────────────

async function sendDiscordWebhook(
	payload: DiscordWebhookPayload,
): Promise<void> {
	const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

	if (!webhookUrl) {
		// Webhook not configured – skip silently.
		return;
	}

	try {
		const response = await fetch(webhookUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			console.error(
				`Discord webhook failed (${response.status}):`,
				await response.text(),
			);
		}
	} catch (error) {
		// Log but never let a Discord failure break the main flow.
		console.error("Failed to send Discord notification:", error);
	}
}

// ── Public notification helpers ──────────────────────────────────────────

/**
 * Notify admins that a customer submitted a bank transfer proof for
 * verification. The admin needs to review the proof and approve/reject.
 */
export async function notifyBankTransferSubmitted(params: {
	orderNumber: string;
	customerName: string;
	customerEmail: string;
	totalFormatted: string;
}): Promise<void> {
	const { orderNumber, customerName, customerEmail, totalFormatted } = params;

	await sendDiscordWebhook({
		embeds: [
			{
				title: "🏦 Bank Transfer Submitted — Action Required",
				description: `A customer has submitted bank transfer proof for **${orderNumber}**. Please verify the payment.`,
				color: COLORS.WARNING,
				fields: [
					{ name: "Order", value: orderNumber, inline: true },
					{ name: "Amount", value: totalFormatted, inline: true },
					{ name: "Customer", value: customerName, inline: true },
					{ name: "Email", value: customerEmail, inline: true },
				],
				timestamp: new Date().toISOString(),
			},
		],
	});
}

/**
 * Notify admins that a customer selected a pickup timeslot.
 * The admin needs to prepare the order for collection.
 */
export async function notifyPickupSlotSelected(params: {
	orderNumber: string;
	customerName: string;
	customerEmail: string;
	pickupDate: string;
	pickupTime: string;
	pickupLabel: string;
}): Promise<void> {
	const {
		orderNumber,
		customerName,
		customerEmail,
		pickupDate,
		pickupTime,
		pickupLabel,
	} = params;

	await sendDiscordWebhook({
		embeds: [
			{
				title: "📦 Pickup Slot Selected — Prepare Order",
				description: `Customer has selected a pickup slot for **${orderNumber}**. Please prepare the order.`,
				color: COLORS.INFO,
				fields: [
					{ name: "Order", value: orderNumber, inline: true },
					{ name: "Customer", value: customerName, inline: true },
					{ name: "Email", value: customerEmail, inline: true },
					{ name: "Pickup Date", value: pickupDate, inline: true },
					{ name: "Pickup Time", value: pickupTime, inline: true },
					{ name: "Slot", value: pickupLabel, inline: true },
				],
				timestamp: new Date().toISOString(),
			},
		],
	});
}
