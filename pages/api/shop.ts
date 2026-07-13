import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { getPriceForPages } from "../../lib/stripe";

const ShopQuerySchema = z.object({
	isColor: z.string().optional(),
	pages: z.string().regex(/^\d+$/, "Pages must be a number").optional(),
});

/**
 * GET /api/shop?pages=42&isColor=false
 *
 * Returns the Stripe product + price for a given page count and colour mode.
 * Used by the PdfOrder component to show pricing before checkout.
 */
export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	try {
		const parsedQuery = ShopQuerySchema.parse(req.query);

		const isColor = parsedQuery.isColor === "true";
		const pages = parsedQuery.pages
			? Number.parseInt(parsedQuery.pages, 10)
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
		// Catalogue/pricing misconfiguration errors thrown by getPriceForPages
		// (no matching product, no default price, no unit amount, invalid page
		// count) are user-actionable — surface them as 400 with the descriptive
		// message rather than an opaque 500, matching the App Router order route.
		const message = error instanceof Error ? error.message : "Unknown error";
		const isUserError =
			error instanceof Error &&
			/please|must|exceeds|unsupported|empty|not received|valid PDF|no print product is configured|no default price configured|stripe catalogue/i.test(
				error.message,
			);
		return res.status(isUserError ? 400 : 500).json({
			message,
			success: false,
		});
	}
}
