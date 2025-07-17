import type { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "../../lib/mongo";
import { getPriceForPages, getProducts } from "../../lib/stripe";

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	try {
		//let test = await getProducts();
		const isColor = req.query.isColor;
		let param = false;
		if (isColor === "true") param = true;
		const price = await getPriceForPages(req.query.pages, param);
		return res.json({
			productId: price.productId,
			price: price.price,
			priceId: price.priceId,
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
