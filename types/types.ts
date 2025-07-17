export type ShopItem = {
	name: string;
	price: string;
	image: string;
};

export type WebsiteText = {
	text: string;
};

export type infoStructure = {
	title: string;
	description: string;
};

export type StripeProduct = {
	id: string;
	priceId: string;
	title: string;
	description: string;
	price: number;
	features: { name: string }[];
};

export type StripeBackendItem = {
	name: string;
	price: string;
	quantity: number;
	productId: string;
	priceId: string;
};

export type OrderRow = {
	orderId?: string;
	name: string;
	email: string;
	pages?: number;
	message: string;
	coursebookName?: string;
	coursebookLink?: string;
	colour: boolean;
	paymentMethod?: string;
	quantity: number;
	paid?: boolean;
	cost: number;
	discounted: boolean;
};
export type OrderPdf = {
	name: string;
	pageCount: number;
	quantity: number;
	price: number;
	isColor: boolean;
};
export type OrderCartPackage = {
	name: string;
	price: number;
};
export type UploadedPdf = {
	name: string;
	pageCount: number;
	price: number;
	priceId: string;
	quantity: number;
	isColor: boolean;
	file: File;
};

export type CartPackage = {
	id: string;
	name: string;
	price: number;
	priceId: string;
	quantity: number;
};

export type product = infoStructure & {
	image: {
		title?: string;
		price?: string;
		description?: string;
		image?: string;
	};
	price: string;
};

export type testimonial = infoStructure & { author: string };
