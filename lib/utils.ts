import CartItem from "../types/models/CartItem";

// https://stackoverflow.com/questions/6860853/generate-random-string-for-div-id
export const guidGenerator = () => {
	var S4 = () =>
		(((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
	return S4() + S4();
};

export const formatItems = (
	items: { name: string; quantity: number; cost: number }[],
): string => {
	const listItems = items.map((item) => {
		return `<li>${item.name} - Qty: ${item.quantity}, Cost: ${item.cost}</li>`;
	});

	const formattedString = listItems.join("");

	return formattedString;
};

export const orderSum = (orderItems: { cost: number }[]) => {
	const sum = orderItems.reduce((acc, item) => acc + item.cost, 0);
	return sum.toFixed(2);
};

/**
 * Parse a numeric env var, falling back to `fallback` when the value is
 * missing, empty, an unsubstituted Docker placeholder (e.g.
 * `__NEXT_PUBLIC_FOO__`), or otherwise non-numeric.
 *
 * Necessary because Next.js inlines NEXT_PUBLIC_* values into the client
 * bundle at build time. When the build runs against a placeholder string
 * (so the docker entrypoint can sed-replace them at startup), `parseInt`
 * on the placeholder returns NaN — which then propagates through every
 * discount calculation in the UI.
 */
const parseNumericEnv = (raw: string | undefined, fallback: number): number => {
	if (!raw) return fallback;
	const trimmed = raw.trim();
	if (trimmed === "" || /^__[A-Z0-9_]+__$/.test(trimmed)) return fallback;
	const parsed = parseInt(trimmed, 10);
	return Number.isFinite(parsed) ? parsed : fallback;
};

export const getMinimumItemsForDiscount = () =>
	parseNumericEnv(process.env.NEXT_PUBLIC_MINIMUM_ITEMS_FOR_DISCOUNT, 2);

export const getPercentOff = () =>
	parseNumericEnv(process.env.NEXT_PUBLIC_DISCOUNT_PERCENT, 0);

export const getItemsWithBulkDiscount = <
	T extends { quantity: number } | CartItem,
>(
	items: T[],
) => {
	const MIN_ITEMS = getMinimumItemsForDiscount();
	return items.filter((item) => {
		if (item instanceof CartItem) {
			return item.getQuantity() >= MIN_ITEMS;
		}
		return item.quantity >= MIN_ITEMS;
	});
};
