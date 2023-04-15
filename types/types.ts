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
    title: string;
    included: string[];
    price: number;
};

export type product = infoStructure & { image: any; price: string };

export type testimonial = infoStructure & { author: string };

