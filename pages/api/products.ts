import { NextApiRequest, NextApiResponse } from "next";
import { getPackages } from "../../lib/stripe";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        let packages = await getPackages();
        // return the posts
        return res.json({
            packages: packages,
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
