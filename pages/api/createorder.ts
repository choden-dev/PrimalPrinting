import { NextApiRequest, NextApiResponse } from "next";
import { OrderRow } from "../../types/types";
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        const orderRow = JSON.parse(res.body);
        return res.json({
            message: response,
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
