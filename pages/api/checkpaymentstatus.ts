import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { updatePaymentStatus } from "../../lib/google";
import { checkSession } from "../../lib/stripe";

const CheckPaymentStatusSchema = z.object({
	session_id: z.string(),
});

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	try {
		const parsedQuery = CheckPaymentStatusSchema.parse(req.query);

		const success = await checkSession(parsedQuery.session_id);
		const orderId = success.orderId;
		const customer = success.customer;
		const price = success.price;

		if (!process.env.BASE_URL) {
			return res.status(500).json({
				message: "BASE_URL environment variable is not defined.",
				success: false,
			});
		}

		if (success.paid) {
			updatePaymentStatus(orderId);
			await fetch(`${process.env.BASE_URL}/api/sendemailcreditcard`, {
				method: "POST",
				body: JSON.stringify({
					name: customer?.name,
					email: customer?.email,
					orderId: orderId,
					price: price || NaN / 100,
				}),
			});
			return res.redirect(307, `/success?orderId=${orderId}`);
		} else {
			return res.redirect(307, "/order");
		}
	} catch (error) {
		if (error instanceof z.ZodError) {
			return res.status(400).json({
				message: error.issues,
				success: false,
			});
		}
		return res.status(500).json({
			message: error instanceof Error ? error.message : "Unknown error",
			success: false,
		});
	}
}
