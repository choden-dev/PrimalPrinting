import { NextApiRequest, NextApiResponse } from "next";
import { sendEmail } from "../../lib/sendgrid";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    sendEmail();
    res.status(200).json({ name: "John Doe" });
}
