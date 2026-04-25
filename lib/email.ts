import path from "node:path";
import nodemailer from "nodemailer";
import pug from "pug";
import { getPayloadClient } from "./payload";

// ── Transporter (reuse existing Gmail SMTP config) ───────────────────────

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
	if (transporter) return transporter;

	transporter = nodemailer.createTransport({
		service: "gmail",
		auth: {
			user: process.env.GMAIL_USER,
			pass: process.env.GMAIL_PASS,
		},
	});

	return transporter;
}

// ── Template rendering ───────────────────────────────────────────────────

const TEMPLATE_DIR = path.resolve(process.cwd(), "lib/templates");

function renderTemplate(
	templateName: string,
	locals: Record<string, unknown>,
): string {
	const templatePath = path.join(TEMPLATE_DIR, `${templateName}.pug`);
	return pug.renderFile(templatePath, locals);
}

// ── Email types ──────────────────────────────────────────────────────────

interface OrderFile {
	fileName: string;
	pageCount: number;
	copies: number;
	colorMode: string;
	paperSize: string;
	doubleSided: boolean;
}

interface TimeslotInfo {
	date: string;
	startTime: string;
	endTime: string;
	label: string;
}

interface PricingInfo {
	subtotal?: number;
	tax?: number;
	total?: number;
}

// ── Contact info (from Payload global) ───────────────────────────────────

async function getContactInfo(): Promise<{
	email: string;
	phone: string;
}> {
	try {
		const payload = await getPayloadClient();
		const contactInfo = await payload.findGlobal({ slug: "contact-info" });
		return {
			email: contactInfo.email || "",
			phone: contactInfo.phone || "",
		};
	} catch {
		return { email: "", phone: "" };
	}
}

// ── Send functions ───────────────────────────────────────────────────────

/**
 * Send an order confirmation email after pickup timeslot is selected.
 * Includes order summary, pricing, and pickup details.
 */
export async function sendOrderConfirmationEmail(params: {
	to: string;
	customerName: string;
	orderNumber: string;
	files: OrderFile[];
	pricing: PricingInfo | undefined;
	timeslot: TimeslotInfo;
	pickupInstructionsHtml?: string | null;
}): Promise<void> {
	const {
		to,
		customerName,
		orderNumber,
		files,
		pricing,
		timeslot,
		pickupInstructionsHtml,
	} = params;

	const formattedDate = timeslot.date
		? new Date(timeslot.date).toLocaleDateString("en-NZ", {
				weekday: "long",
				day: "numeric",
				month: "long",
				year: "numeric",
			})
		: "TBD";

	const common = await buildCommonLocals(customerName);

	const html = renderTemplate("orderConfirmation", {
		...common,
		orderNumber,
		files: formatFilesForTemplate(files),
		...formatPricingForTemplate(pricing),
		pickupDate: formattedDate,
		pickupTime: `${timeslot.startTime} – ${timeslot.endTime}`,
		pickupLabel: timeslot.label,
		pickupInstructionsHtml: pickupInstructionsHtml || null,
	});

	await getTransporter().sendMail({
		from: fromAddress(),
		to,
		subject: `Order Confirmed — ${orderNumber}`,
		html,
	});
}

/**
 * Send an email confirming that bank transfer proof has been received
 * and the order is now paid. Customer can proceed to select a pickup slot.
 */
export async function sendBankTransferReceivedEmail(params: {
	to: string;
	customerName: string;
	orderNumber: string;
	files: OrderFile[];
	pricing: PricingInfo | undefined;
	hasTimeslots: boolean;
}): Promise<void> {
	const { to, customerName, orderNumber, files, pricing, hasTimeslots } =
		params;

	const common = await buildCommonLocals(customerName);

	const html = renderTemplate("paymentPendingVerification", {
		...common,
		orderNumber,
		files: formatFilesForTemplate(files),
		...formatPricingForTemplate(pricing),
		hasTimeslots,
	});

	await getTransporter().sendMail({
		from: fromAddress(),
		to,
		subject: hasTimeslots
			? `Payment Received — ${orderNumber} — Select Your Pickup Slot`
			: `Payment Received — ${orderNumber} — We'll Notify You When Timeslots Are Ready`,
		html,
	});
}

/**
 * Send a payment confirmation email after Stripe payment succeeds.
 * Tells the customer to select a pickup timeslot, or to wait for one
 * if none are currently available.
 */
export async function sendPaymentConfirmationEmail(params: {
	to: string;
	customerName: string;
	orderNumber: string;
	files: OrderFile[];
	pricing: PricingInfo | undefined;
	hasTimeslots: boolean;
}): Promise<void> {
	const { to, customerName, orderNumber, files, pricing, hasTimeslots } =
		params;

	const common = await buildCommonLocals(customerName);

	const html = renderTemplate("paymentConfirmation", {
		...common,
		orderNumber,
		files: formatFilesForTemplate(files),
		...formatPricingForTemplate(pricing),
		hasTimeslots,
	});

	await getTransporter().sendMail({
		from: fromAddress(),
		to,
		subject: `Payment Confirmed — ${orderNumber} — ${hasTimeslots ? "Select Your Pickup Slot" : "We'll Notify You When Timeslots Are Ready"}`,
		html,
	});
}

/**
 * Send a bulk notification email to customers whose orders are PAID
 * but have no pickup timeslot selected, letting them know that
 * timeslots are now available.
 */
export async function sendTimeslotsAvailableEmail(params: {
	to: string;
	customerName: string;
	orders: { orderNumber: string; files: OrderFile[] }[];
}): Promise<void> {
	const { to, customerName, orders } = params;

	const common = await buildCommonLocals(customerName);

	const html = renderTemplate("timeslotsAvailable", {
		...common,
		orders: orders.map((o) => ({
			...o,
			files: formatFilesForTemplate(o.files),
		})),
	});

	await getTransporter().sendMail({
		from: fromAddress(),
		to,
		subject: "Pickup Timeslots Available — Select Your Slot Now",
		html,
	});
}

/**
 * Send a notification email when an admin updates a timeslot's date/time.
 * Each affected customer receives one email per order in that timeslot,
 * showing the diff of what changed and their order summary.
 */
export async function sendTimeslotChangedEmail(params: {
	to: string;
	customerName: string;
	orderNumber: string;
	files: OrderFile[];
	pricing: PricingInfo | undefined;
	previous: TimeslotInfo;
	updated: TimeslotInfo;
}): Promise<void> {
	const { to, customerName, orderNumber, files, pricing, previous, updated } =
		params;

	const formatDate = (d: string | undefined) =>
		d
			? new Date(d).toLocaleDateString("en-NZ", {
					weekday: "long",
					day: "numeric",
					month: "long",
					year: "numeric",
				})
			: "TBD";

	const previousDate = formatDate(previous.date);
	const newDate = formatDate(updated.date);
	const dateChanged = previousDate !== newDate;
	const startTimeChanged = previous.startTime !== updated.startTime;
	const endTimeChanged = previous.endTime !== updated.endTime;

	const common = await buildCommonLocals(customerName);

	const html = renderTemplate("timeslotChanged", {
		...common,
		orderNumber,
		files: formatFilesForTemplate(files),
		...formatPricingForTemplate(pricing),
		// Diff flags
		dateChanged,
		previousDate,
		newDate,
		startTimeChanged,
		previousStartTime: previous.startTime,
		newStartTime: updated.startTime,
		endTimeChanged,
		previousEndTime: previous.endTime,
		newEndTime: updated.endTime,
		// Updated pickup details
		pickupDate: newDate,
		pickupTime: `${updated.startTime} – ${updated.endTime}`,
		pickupLabel: updated.label,
	});

	await getTransporter().sendMail({
		from: fromAddress(),
		to,
		subject: `Pickup Time Updated — ${orderNumber}`,
		html,
	});
}

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Convert Payload rich-text (Lexical/Slate) block content into simple HTML
 * suitable for email templates. Handles the common node types.
 */
// biome-ignore lint/suspicious/noExplicitAny: rich text nodes are loosely typed
export function richTextToHtml(nodes: any[] | null | undefined): string {
	if (!nodes || nodes.length === 0) return "";
	return nodes.map(nodeToHtml).join("");
}

// biome-ignore lint/suspicious/noExplicitAny: rich text nodes vary in shape
function nodeToHtml(node: any): string {
	if (!node) return "";

	// Lexical text node
	if (node.type === "text" || (!node.type && typeof node.text === "string")) {
		let text: string = escapeHtml(node.text || "");
		if (node.bold || node.format === 1) text = `<strong>${text}</strong>`;
		if (node.italic || node.format === 2) text = `<em>${text}</em>`;
		if (node.underline || node.format === 4) text = `<u>${text}</u>`;
		return text;
	}

	const children = node.children
		? // biome-ignore lint/suspicious/noExplicitAny: recursive structure
			node.children
				.map((c: any) => nodeToHtml(c))
				.join("")
		: "";

	switch (node.type) {
		case "paragraph":
			return `<p>${children}</p>`;
		case "heading":
			return `<h${node.tag || 3}>${children}</h${node.tag || 3}>`;
		case "list":
			return node.listType === "number"
				? `<ol>${children}</ol>`
				: `<ul>${children}</ul>`;
		case "listitem":
			return `<li>${children}</li>`;
		case "link":
		case "autolink":
			return `<a href="${escapeHtml(node.url || "#")}">${children}</a>`;
		case "quote":
			return `<blockquote>${children}</blockquote>`;
		case "linebreak":
			return "<br/>";
		case "root":
			return children;
		default:
			return children || "";
	}
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/**
 * Extract rich text HTML from a pickup instruction profile object.
 * Works with the PickupInstructionProfiles collection's blocks field.
 */
// biome-ignore lint/suspicious/noExplicitAny: profile shape varies when populated vs ID
export function pickupProfileToHtml(profile: any): string | null {
	if (!profile || typeof profile === "string") return null;
	const blocks = profile.instructions;
	if (!Array.isArray(blocks) || blocks.length === 0) return null;

	const parts: string[] = [];
	for (const block of blocks) {
		if (block.blockType === "richText" && block.content?.root?.children) {
			parts.push(richTextToHtml(block.content.root.children));
		}
	}
	return parts.length > 0 ? parts.join("") : null;
}

function formatCents(cents: number | undefined | null): string {
	if (cents == null) return "$0.00";
	return `$${(cents / 100).toFixed(2)}`;
}

/** Map raw OrderFile[] into template-friendly objects with display labels. */
function formatFilesForTemplate(files: OrderFile[]): Record<string, unknown>[] {
	return files.map((f) => ({
		...f,
		colorLabel: f.colorMode === "COLOR" ? "Colour" : "B&W",
		sidedLabel: f.doubleSided ? "Double-sided" : "Single-sided",
	}));
}

/** Format a PricingInfo into display-ready strings. */
function formatPricingForTemplate(pricing: PricingInfo | undefined): {
	subtotal: string;
	tax: string;
	total: string;
} {
	return {
		subtotal: formatCents(pricing?.subtotal),
		tax: formatCents(pricing?.tax),
		total: formatCents(pricing?.total),
	};
}

/** Build the common template locals shared by every email. */
async function buildCommonLocals(customerName: string) {
	const contact = await getContactInfo();
	return {
		customerName: customerName || "Customer",
		ordersUrl: `${process.env.NEXT_PUBLIC_BASE_URL || ""}/my-orders`,
		contactEmail: contact.email,
		contactPhone: contact.phone,
	};
}

/** Build the "from" address used by every outgoing email. */
function fromAddress(): string {
	return `"Primal Printing" <${process.env.GMAIL_USER}>`;
}
