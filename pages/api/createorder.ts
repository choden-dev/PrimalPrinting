import { NextApiRequest, NextApiResponse } from "next";
import { guidGenerator } from "../../lib/utils";
import { OrderRow } from "../../types/types";
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        const orderId = guidGenerator();
        const ordersToAdd: OrderRow[] = [];
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
