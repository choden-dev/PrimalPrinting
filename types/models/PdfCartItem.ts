import CartItem from "./CartItem";

export default class PdfCartItem extends CartItem {
	constructor(
		public id: string,
		public displayName: string,
		protected quantity: number,
		protected unitPrice: number,
		public priceId: string,
		private pages: number,
		public isColor: boolean,
		public file: File,
		// not unique, but needed for stripe
		public productId: string,
	) {
		super(id, displayName, quantity, unitPrice, priceId);
	}

	public getPages() {
		return this.pages;
	}

	public setPages(newPages: number) {
		this.pages = newPages;
	}
}
