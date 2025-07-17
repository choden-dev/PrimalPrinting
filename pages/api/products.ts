import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { findPrice, getPackages } from "../../lib/stripe";

const ProductsSchema = z.object({}); // No specific input expected for this handler

export default async function handler(
	_req: NextApiRequest,
	res: NextApiResponse,
) {
	try {
		const packages = await getPackages();

		await Promise.all(
			packages.data.map(async (pack) => {
				if (!pack.default_price) {
					throw new Error("Package default price is missing");
				}
				const price = await findPrice(pack.default_price.toString());
				(pack as any).price = price; // Temporarily cast to any to add price property
			}),
		);

		return res.json({
			packages: packages,
			success: true,
		});
	} catch (error) {
		return res.status(500).json({
			message: error instanceof Error ? error.message : "Unknown error",
			success: false,
		});
	}
}
