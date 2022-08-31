export type ShopItem = {
    name: string;
    price: string;
    image: string;
}

export type WebsiteText = {
    text: string;
}

export type infoStructure = {
    title: string;
    description: string;
}

export type product = infoStructure & { image: any, price: string }
