import { getMinimumItemsForDiscount, getPercentOff } from "../../lib/utils";

export default class CartItem {
  constructor(
    public id: string,
    public displayName: string,
    protected quantity: number,
    protected unitPrice: number,
    public priceId: string
  ) {}

  public getDisplayPrice() {
    let percentagePrice = 1;
    if (this.shouldApplyDiscount()) {
      percentagePrice = percentagePrice - getPercentOff() / 100;
    }
    return percentagePrice * (this.quantity * this.unitPrice);
  }

  public setUnitPrice(newUnitPrice: number) {
    this.unitPrice = newUnitPrice;
  }

  public getQuantity() {
    return this.quantity;
  }

  public shouldApplyDiscount() {
    return this.quantity >= getMinimumItemsForDiscount();
  }

  public setQuantity(quantity: number) {
    this.quantity = quantity;
  }
}
