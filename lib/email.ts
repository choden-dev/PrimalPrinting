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
}): Promise<void> {
	const { to, customerName, orderNumber, files, pricing, timeslot } = params;

	const formattedDate = timeslot.date
		? new Date(timeslot.date).toLocaleDateString("en-NZ", {
				weekday: "long",
				day: "numeric",
				month: "long",
				year: "numeric",
			})
		: "TBD";

	const contact = await getContactInfo();

	const html = renderTemplate("orderConfirmation", {
		customerName: customerName || "Customer",
		orderNumber,
		files: files.map((f) => ({
			...f,
			colorLabel: f.colorMode === "COLOR" ? "Colour" : "B&W",
			sidedLabel: f.doubleSided ? "Double-sided" : "Single-sided",
		})),
		subtotal: formatCents(pricing?.subtotal),
		tax: formatCents(pricing?.tax),
		total: formatCents(pricing?.total),
		pickupDate: formattedDate,
		pickupTime: `${timeslot.startTime} – ${timeslot.endTime}`,
		pickupLabel: timeslot.label,
		contactEmail: contact.email,
		contactPhone: contact.phone,
	});

	await getTransporter().sendMail({
		from: `"Primal Printing" <${process.env.GMAIL_USER}>`,
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
	total: number | undefined;
}): Promise<void> {
	const { to, customerName, orderNumber, total } = params;

	const contact = await getContactInfo();

	const html = renderTemplate("paymentPendingVerification", {
		customerName: customerName || "Customer",
		orderNumber,
		total: formatCents(total),
		contactEmail: contact.email,
		contactPhone: contact.phone,
	});

	await getTransporter().sendMail({
		from: `"Primal Printing" <${process.env.GMAIL_USER}>`,
		to,
		subject: `Payment Received — ${orderNumber} — Select Your Pickup Slot`,
		html,
	});
}

// ── Helpers ──────────────────────────────────────────────────────────────

function formatCents(cents: number | undefined | null): string {
	if (cents == null) return "$0.00";
	return `$${(cents / 100).toFixed(2)}`;
}
