import CartItem from "../types/models/CartItem";

// https://stackoverflow.com/questions/6860853/generate-random-string-for-div-id
export const guidGenerator = () => {
	var S4 = () =>
		(((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
	return S4() + S4();
};

export const formatItems = (items): string => {
	const listItems = items.map((item) => {
		return `<li>${item.name} - Qty: ${item.quantity}, Cost: ${item.cost}</li>`;
	});

	const formattedString = listItems.join("");

	return formattedString;
};

export const orderSum = (orderItems) => {
	let sum = 0;
	orderItems.map((item) => {
		sum += item.cost;
	});
	return sum.toFixed(2);
};

export const getMinimumItemsForDiscount = () =>
	parseInt(process.env.NEXT_PUBLIC_MINIMUM_ITEMS_FOR_DISCOUNT ?? "2");

export const getPercentOff = () =>
	parseInt(process.env.NEXT_PUBLIC_DISCOUNT_PERCENT ?? "0");

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
