import { NextApiRequest, NextApiResponse } from "next";
import { checkSession } from "../../lib/stripe";
import { updatePaymentStatus } from "../../lib/google";
export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	try {
		const success = await checkSession(req.query.session_id);
		let orderId = success.orderId;
		const customer = success.customer;
		const price = success.price;

		if (success.paid) {
			updatePaymentStatus(orderId);
			await fetch(`${process.env.BASE_URL}/api/sendemailcreditcard`, {
				method: "POST",
				body: JSON.stringify({
					name: customer?.name,
					email: customer?.email,
					orderId: orderId,
					price: price / 100,
				}),
			});
			return res.redirect(307, `/success?orderId=${orderId}`);
		} else {
			return res.redirect(307, "/order");
		}
	} catch (error) {
		// return the error
		return res.json({
			message: new Error(error).message,
			success: false,
		});
	}
}
