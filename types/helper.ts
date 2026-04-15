export type IAddOrder = (
	id: string,
	name: string,
	priceId: string,
	price: number,
	quantity: number,
) => void;
