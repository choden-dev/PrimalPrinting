import { NextApiRequest, NextApiResponse } from "next";
import { checkSession } from "../../lib/stripe";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        const success = await checkSession(req.query.session_id);
        if (success) {
            return res.redirect(307, "/success");
        } else {
            return res.redirect(307, "/");
        }
    } catch (error) {
        // return the error
        return res.json({
            message: new Error(error).message,
            success: false,
        });
    }
}
