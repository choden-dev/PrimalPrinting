import type { NextApiRequest, NextApiResponse } from "next";
import { sendEmailBankTransfer } from "../../lib/nodemailer";

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	const body = JSON.parse(req.body);
	const success = await sendEmailBankTransfer(
		body.email,
		body.name,
		body.orderId,
		body.items,
		body.price,
	);
	res.status(200).json({ success: success });
}
