import { NextApiRequest, NextApiResponse } from "next";
import { checkSession } from "../../lib/stripe";
import { updatePaymentStatus } from "../../lib/google";
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        const success = await checkSession(req.query.session_id);
        let orderId = success.orderId;
        if (success.paid) {
            updatePaymentStatus(orderId);
            return res.redirect(307, `/success?orderId=${orderId}`);
        } else {
            return res.redirect(307, "/order");
        }
    } catch (error) {
        // return the error
        return res.json({
            message: new Error(error).message,
            success: false,
        });
    }
}
