import { NextApiRequest, NextApiResponse } from "next";
import { authenticateGoogle, uploadToDrive, multer } from "../../lib/google";
import { Blob } from "buffer";
export const config = {
	api: {
		bodyParser: {
			sizeLimit: "20mb",
		},
	},
};

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	try {
		const reqBody = req.body;
		const response = await fetch(process.env.UPLOAD_SCRIPT_URL!, {
			method: "POST",
			body: reqBody,
		});
		const data = await response.json();
		return res.json({
			message: data,
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
