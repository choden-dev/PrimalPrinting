//unused
export const formatText = (text: string): string => {
	return text.replaceAll("[b]", "<b>").replaceAll("[*b]", "</ b>");
};

export interface IAddOrder {
	(
		id: string,
		name: string,
		priceId: string,
		price: number,
		quantity: number,
	): void;
}
