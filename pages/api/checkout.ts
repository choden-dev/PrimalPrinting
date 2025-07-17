import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import {
	createCoupons,
	createSession,
	createUniqueProductsForDuplicates,
} from "../../lib/stripe";

const CheckoutSchema = z.object({
	items: z.array(
		z.object({
			id: z.string(),
			quantity: z.number().min(1),
			name: z.string(),
			price: z.string(), // Changed to string to match expected type
			productId: z.string(),
			priceId: z.string(),
		}),
	),
	orderId: z.string(),
	email: z.string().email(),
});

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	try {
		const parsedBody = CheckoutSchema.parse(JSON.parse(req.body));

		const updatedItems = await createUniqueProductsForDuplicates(
			parsedBody.items,
		);
		const coupon = await createCoupons(updatedItems);

		const session = await createSession(
			updatedItems,
			parsedBody.orderId,
			parsedBody.email,
			coupon,
		);

		if (!session.metadata || !session.metadata.orderId) {
			return res.status(500).json({
				message: "Session metadata is missing orderId",
				success: false,
			});
		}

		return res.json({
			paymentLink: session.url,
			orderId: session.metadata.orderId,
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
