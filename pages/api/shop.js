import { connectToDatabase } from "../../lib/mongo";
import { getProducts, getPriceForPages } from "../../lib/stripe";

export default async function handler(req, res) {
    try {
        //let test = await getProducts();
        let price = await getPriceForPages(req.query.pages, true);
        // return the posts
        return res.json({
            price: price,
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
