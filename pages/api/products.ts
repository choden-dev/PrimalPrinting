import { NextApiRequest, NextApiResponse } from "next";
import { findPrice, getPackages } from "../../lib/stripe";

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	try {
		let packages = await getPackages();
		// return the posts
		await Promise.all(
			packages.data.map(async (pack) => {
				const price = await findPrice(pack.default_price!.toString());
				pack.price = price;
			}),
		);
		return res.json({
			packages: packages,
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
