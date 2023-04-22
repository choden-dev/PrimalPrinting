import { NextApiRequest, NextApiResponse } from "next";
import { createSession } from "../../lib/stripe";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        const items = JSON.parse(req.query.items);
        const paymentLink = await createSession(items);
        return res.json({
            paymentLink: paymentLink,
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
