export default class CartItem {
  constructor(
    public id: string,
    public displayName: string,
    private quantity: number,
    private unitPrice: number,
    public priceId: string
  ) {}

  public getDisplayPrice() {
    return this.quantity * this.unitPrice;
  }

  public getQuantity() {
    return this.quantity;
  }

  public setQuantity(quantity: number) {
    this.quantity = quantity;
  }
}
