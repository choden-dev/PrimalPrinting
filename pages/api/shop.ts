import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { getPriceForPages } from "../../lib/stripe";

const ShopQuerySchema = z.object({
	isColor: z.string().optional(),
	pages: z.string().regex(/^\d+$/, "Pages must be a number").optional(),
});

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	try {
		const parsedQuery = ShopQuerySchema.parse(req.query);

		const isColor = parsedQuery.isColor === "true";
		const pages = parsedQuery.pages
			? parseInt(parsedQuery.pages, 10)
			: undefined;

		if (pages === undefined) {
			return res.status(400).json({
				message: "Pages parameter is required and must be a number.",
				success: false,
			});
		}

		const price = await getPriceForPages(pages, isColor);
		return res.json({
			productId: price.productId,
			price: price.price,
			priceId: price.priceId,
			success: true,
		});
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
