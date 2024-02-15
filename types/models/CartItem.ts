export default class CartItem {
  constructor(
    public id: string,
    public displayName: string,
    protected quantity: number,
    protected unitPrice: number,
    public priceId: string
  ) {}

  public getDisplayPrice() {
    return this.quantity * this.unitPrice;
  }

  public setUnitPrice(newUnitPrice: number) {
    this.unitPrice = newUnitPrice;
  }
  public getQuantity() {
    return this.quantity;
  }

  public setQuantity(quantity: number) {
    this.quantity = quantity;
  }
}
