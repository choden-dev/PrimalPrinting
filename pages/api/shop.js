import { connectToDatabase } from "../../lib/mongo";
import { getProducts } from "../../lib/stripe";

export default async function handler(req, res) {
    try {
        let test = await getProducts();
        // return the posts
        return res.json({
            message: test,
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
