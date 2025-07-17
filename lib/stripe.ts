import Stripe from "stripe";
import { StripeBackendItem } from "../types/types";
import {
	getMinimumItemsForDiscount,
	getPercentOff,
	getItemsWithBulkDiscount,
} from "./utils";
let stripeCached: any = null;

// caches the connection or starts a new one
const makeStripeConnection = async () => {
	if (stripeCached) return stripeCached;
	stripeCached = new Stripe(`${process.env.STRIPE_PRIVATE_KEY}`, {
		apiVersion: `2022-11-15`,
	});
	return stripeCached;
};
export const getProducts = async () => {
	const stripe: Stripe = await makeStripeConnection();
	const products = await stripe.products.list({
		limit: 3,
	});
	return products;
};

export const findPrice = async (priceId: string) => {
	const stripe: Stripe = await makeStripeConnection();
	const price = await stripe.prices.retrieve(priceId);
	return price.unit_amount;
};

export const getPackages = async () => {
	const stripe: Stripe = await makeStripeConnection();
	const packages = await stripe.products.search({
		query: `metadata["type"]: 'package' AND active: 'true' `,
	});
	return packages;
};

export const getPriceForPages = async (pages: number, isColor: boolean) => {
	const stripe: Stripe = await makeStripeConnection();
	let pageRange = { maxPages: -1, minPages: -1 };
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
		query: `metadata["maxPages"]:'${
			pageRange.maxPages
		}' AND metadata["minPages"]:'${pageRange.minPages}' AND metadata["type"]:${
			isColor ? "'Colour'" : "'B/W'"
		}`,
	});
	const priceId = products.data[0].default_price!.toString();
	const price = await findPrice(priceId);
	const productId = products.data[0].id;
	return {
		price: price,
		priceId: priceId,
		productId: productId,
	};
};

export const createUniqueProductsForDuplicates = async (
	items: (StripeBackendItem & { name: string })[],
) => {
	const stripe: Stripe = await makeStripeConnection();

	await Promise.all(
		items.map(async (item, index) => {
			const duplicateIndex = items.findIndex(
				(otherItem, otherIndex) =>
					otherIndex !== index && otherItem.price === item.price,
			);

			if (duplicateIndex !== -1) {
				const duplicate = items[duplicateIndex];
				const price = await stripe.prices.retrieve(duplicate.priceId);
				const product = await stripe.products.create({
					name: duplicate.name,
					default_price_data: {
						unit_amount_decimal: price.unit_amount_decimal as string,
						currency: price.currency,
					},
				});

				items[index].productId = product.id;
				items[index].price = product.default_price as string;
			}
		}),
	);

	return items;
};

export const createCoupons = async <T extends StripeBackendItem>(
	items: T[],
) => {
	const stripe: Stripe = await makeStripeConnection();

	const itemsWithBulkDiscount = getItemsWithBulkDiscount(items);
	if (itemsWithBulkDiscount.length === 0) return undefined;

	const coupon = await stripe.coupons.create({
		percent_off: getPercentOff(),
		applies_to: {
			products: itemsWithBulkDiscount.map((item) => item.productId),
		},
		duration: "once",
		name: `${getMinimumItemsForDiscount()} or more discount!`,
	});
	return coupon;
};

export const createSession = async (
	items: StripeBackendItem[],
	orderId: string,
	email: string,
	coupon?: Stripe.Coupon,
) => {
	const stripe: Stripe = await makeStripeConnection();
	const session = await stripe.checkout.sessions.create({
		mode: "payment",
		line_items: items.map(
			({ productId, priceId, name, ...relevant }) => relevant,
		),
		...(coupon !== undefined && {
			discounts: [{ coupon: coupon ? coupon.id : undefined }],
		}),
		...(coupon === undefined && { allow_promotion_codes: true }),

		success_url: `${process.env
			.STRIPE_SUCCESS_URL!}?session_id={CHECKOUT_SESSION_ID}`,
		customer_email: email,
		cancel_url: `${process.env
			.STRIPE_CANCEL_URL!}?session_id={CHECKOUT_SESSION_ID}`,
		metadata: { orderId: orderId },
	});
	return session;
};

export const checkSession = async (sessionId: string) => {
	const stripe: Stripe = await makeStripeConnection();
	const session = await stripe.checkout.sessions.retrieve(sessionId);

	return {
		price: session.amount_total,
		customer: session.customer_details,
		paid: session.status === "complete",
		orderId: session.metadata.orderId,
	};
};
