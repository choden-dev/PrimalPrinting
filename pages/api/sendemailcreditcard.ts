import { NextApiRequest, NextApiResponse } from "next";
import { sendEmailStripePayment } from "../../lib/sendgrid";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const body = JSON.parse(req.body);
    const success = sendEmailStripePayment(
        body.email,
        body.name,
        body.orderId,
        body.price
    );
    res.status(200).json({ success: success });
}
