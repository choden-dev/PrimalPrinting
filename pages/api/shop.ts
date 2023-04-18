import { connectToDatabase } from "../../lib/mongo";
import { NextApiRequest, NextApiResponse } from "next";
import { getProducts, getPriceForPages } from "../../lib/stripe";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        //let test = await getProducts();
        let price = await getPriceForPages(req.query.pages, true);
        // return the posts
        return res.json({
            price: price.price,
            priceId: price.priceId,
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
