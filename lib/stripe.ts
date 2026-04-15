import Stripe from "stripe";

let stripeCached: Stripe;

// caches the connection or starts a new one
const makeStripeConnection = async () => {
	if (stripeCached) return stripeCached;
	stripeCached = new Stripe(`${process.env.STRIPE_PRIVATE_KEY}`, {
		apiVersion: `2022-11-15`,
	});
	return stripeCached;
};

export const findPrice = async (priceId: string) => {
	const stripe: Stripe = await makeStripeConnection();
	const price = await stripe.prices.retrieve(priceId);
	return price.unit_amount;
};

/**
 * Look up the Stripe product + price for a given page count and colour mode.
 * Products are configured in Stripe with metadata:
 *   - minPages / maxPages: page range
 *   - type: "Colour" or "B/W"
 */
export const getPriceForPages = async (pages: number, isColor: boolean) => {
	const stripe: Stripe = await makeStripeConnection();
	const pageRange = { maxPages: -1, minPages: -1 };
	const updatePageRange = (minPages: number, maxPages: number): void => {
		pageRange.minPages = minPages;
		pageRange.maxPages = maxPages;
	};
	switch (true) {
		case pages >= 1 && pages < 100:
			updatePageRange(1, 99);
			break;
		case pages >= 100 && pages < 200:
			updatePageRange(100, 199);
			break;
		case pages >= 200 && pages < 300:
			updatePageRange(200, 299);
			break;
		case pages >= 300 && pages < 350:
			updatePageRange(300, 349);
			break;
		case pages >= 350 && pages < 400:
			updatePageRange(350, 399);
			break;
		case pages >= 400:
			updatePageRange(400, 400);
			break;
		default:
			throw new Error("Invalid Page Range!");
	}
	const products = await stripe.products.search({
		query: `metadata["maxPages"]:'${pageRange.maxPages}' AND metadata["minPages"]:'${pageRange.minPages}' AND metadata["type"]:${isColor ? "'Colour'" : "'B/W'"}`,
	});
	const priceId = products.data[0].default_price?.toString();
	const price = await findPrice(priceId || "");
	const productId = products.data[0].id;
	return {
		price: price,
		priceId: priceId,
		productId: productId,
	};
};

/**
 * Calculate the total price for a set of order files server-side.
 * This is the source of truth — never trust client-side pricing.
 */
export const calculateOrderTotal = async (
	files: {
		pageCount: number;
		copies: number;
		colorMode: string;
	}[],
): Promise<{ subtotal: number; total: number }> => {
	let subtotal = 0;

	for (const file of files) {
		const isColor = file.colorMode === "COLOR";
		const priceData = await getPriceForPages(file.pageCount, isColor);
		const unitPrice = priceData.price || 0;
		// unitPrice is per copy, multiply by copies
		subtotal += unitPrice * file.copies;
	}

	return {
		subtotal,
		total: subtotal, // no tax for now
	};
};
