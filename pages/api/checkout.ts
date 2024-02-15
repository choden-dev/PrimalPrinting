import { NextApiRequest, NextApiResponse } from "next";
import { createCoupon, createSession } from "../../lib/stripe";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const items = JSON.parse(req.body);
    const coupon = await createCoupon(items.items);
    const session = await createSession(
      items.items,
      items.orderId,
      items.email,
      coupon
    );
    return res.json({
      paymentLink: session.url,
      orderId: session.metadata.orderId,
      success: true,
    });
  } catch (error) {
    // return the error
    return res.json({
      message: new Error(error).message,
      success: false,
    });
  }
}
