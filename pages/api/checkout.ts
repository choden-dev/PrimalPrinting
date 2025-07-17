import { NextApiRequest, NextApiResponse } from "next";
import {
	createCoupons,
	createSession,
	createUniqueProductsForDuplicates,
} from "../../lib/stripe";

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	try {
		const items = JSON.parse(req.body);

		const updatedItems = await createUniqueProductsForDuplicates(items.items);
		const coupon = await createCoupons(updatedItems);

		const session = await createSession(
			updatedItems,
			items.orderId,
			items.email,
			coupon,
		);
		return res.json({
			paymentLink: session.url,
			orderId: session.metadata.orderId,
			success: true,
		});
	} catch (error) {
		// return the error
		return res.json({
			message: new Error(error).message,
			success: false,
		});
	}
}
