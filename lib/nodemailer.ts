import nodemailer from "nodemailer";
import path from "path";
import pug from "pug";

const transporter = nodemailer.createTransport({
	service: "gmail",
	host: "smtp.gmail.com",
	port: 465,
	secure: true,
	auth: {
		user: process.env.GMAIL_USER,
		pass: process.env.GMAIL_PASS,
	},
});

const bankTransferTemplatePath = path.join(
	process.cwd(),
	"lib",
	"templates",
	"bankTransfer.pug",
);
const creditCardTemplatePath = path.join(
	process.cwd(),
	"lib",
	"templates",
	"creditCard.pug",
);

export const sendEmailBankTransfer = async (
	email: string,
	name: string,
	orderId: string,
	items: string,
	price: string,
): Promise<boolean> => {
	const html = pug.renderFile(bankTransferTemplatePath, {
		name,
		orderId,
		items,
		price,
	});
	const mailOptions = {
		from: process.env.GMAIL_USER,
		to: email,
		subject: `Order Confirmation (Bank Transfer) - Order #${orderId}`,
		html,
	};
	try {
		await transporter.sendMail(mailOptions);
		return true;
	} catch (error) {
		console.error(error);
		return false;
	}
};

export const sendEmailStripePayment = async (
	email: string,
	name: string,
	orderId: string,
	price: string,
	items: string[] = [],
): Promise<boolean> => {
	const html = pug.renderFile(creditCardTemplatePath, {
		name,
		orderId,
		price,
		items: items.join(", "),
	});
	const mailOptions = {
		from: process.env.GMAIL_USER,
		to: email,
		subject: `Order Confirmation (Credit Card) - Order #${orderId}`,
		html,
	};
	try {
		await transporter.sendMail(mailOptions);
		return true;
	} catch (error) {
		console.error(error);
		return false;
	}
};
