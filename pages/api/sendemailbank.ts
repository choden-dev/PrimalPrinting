import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { sendEmailBankTransfer } from "../../lib/nodemailer";

const schema = z.object({
	email: z.email(),
	name: z.string().min(1),
	orderId: z.string().min(1),
	items: z.any(),
	price: z.string().min(1),
});

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	let body: z.infer<typeof schema>;
	try {
		body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
	} catch {
		return res.status(400).json({ error: "Invalid JSON" });
	}
	const parseResult = schema.safeParse(body);
	if (!parseResult.success) {
		return res.status(400).json({
			error: "Invalid request body",
			details: parseResult.error,
		});
	}
	const success = await sendEmailBankTransfer(
		body.email,
		body.name,
		body.orderId,
		body.items,
		body.price,
	);
	res.status(200).json({ success: success });
}
