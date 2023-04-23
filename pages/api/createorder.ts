import { NextApiRequest, NextApiResponse } from "next";
import { guidGenerator } from "../../lib/utils";
import { appendToSpreadSheet } from "../../lib/google";
import { OrderRow } from "../../types/types";
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        const orderId = guidGenerator();
        const toAppend: any[][] = [];
        const orderRows: OrderRow[] = JSON.parse(req.body);
        orderRows.map((row) => {
            const temp = [
                orderId,
                row.name,
                row.email,
                row.pages,
                row.coursebookLink,
                row.colour,
                row.paymentMethod,
                row.quantity,
                row.paid,
                row.cost,
                row.message,
            ];
            toAppend.push(temp);
        });
        appendToSpreadSheet(toAppend);
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
