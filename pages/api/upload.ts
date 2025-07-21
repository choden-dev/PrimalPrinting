import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

export const config = {
	api: {
		bodyParser: {
			sizeLimit: "20mb",
		},
	},
}; // Retained for Next.js API route configuration

const UploadSchema = z.object({
	file: z.string(), // Assuming the body contains a file as a string (e.g., base64 or URL)
});

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	try {
		const reqBody = UploadSchema.parse(req.body);

		if (!process.env.UPLOAD_SCRIPT_URL) {
			return res.status(500).json({
				message: "UPLOAD_SCRIPT_URL environment variable is not defined.",
				success: false,
			});
		}

		const response = await fetch(process.env.UPLOAD_SCRIPT_URL, {
			method: "POST",
			body: JSON.stringify(reqBody),
			headers: { "Content-Type": "application/json" },
		});

		if (!response.ok) {
			return res.status(response.status).json({
				message: `Failed to upload: ${response.statusText}`,
				success: false,
			});
		}

		const data = await response.json();
		return res.json({
			message: data,
			success: true,
		});
	} catch (error) {
		if (error instanceof z.ZodError) {
			return res.status(400).json({
				message: error.issues,
				success: false,
			});
		}
		return res.status(500).json({
			message: error instanceof Error ? error.message : "Unknown error",
			success: false,
		});
	}
}
