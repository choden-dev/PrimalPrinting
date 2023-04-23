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

export type OrderPackage = {
    id: string;
    priceId: string;
    title: string;
    description: string;
    price: number;
};

export type OrderRow = {
    orderId?: string;
    name: string;
    email: string;
    pages: number;
    message: string;
    coursebookLink?: string;
    colour: boolean;
    paymentMethod?: string;
    quantity: number;
    paid?: boolean;
    cost: number;
};

export type product = infoStructure & { image: any; price: string };

export type testimonial = infoStructure & { author: string };
