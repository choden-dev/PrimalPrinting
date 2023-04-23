import { NextApiRequest, NextApiResponse } from "next";
import { guidGenerator } from "../../lib/utils";
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        const orderId = guidGenerator();
        const orderRow = JSON.parse(req.body);

        return res.json({
            message: orderId,
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
