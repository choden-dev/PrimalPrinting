import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { appendToSpreadSheet } from "../../lib/google";
import { guidGenerator } from "../../lib/utils";
import type { OrderRow } from "../../types/types";

const CreateOrderSchema = z.array(
	z.object({
		name: z.string(),
		email: z.string().email(),
		pages: z.number().min(1),
		coursebookName: z.string().optional(),
		coursebookLink: z.string().optional(),
		colour: z.boolean(),
		paymentMethod: z.string(),
		quantity: z.number().min(1),
		paid: z.boolean(),
		cost: z.number().min(0),
		message: z.string(),
		discounted: z.boolean(),
	}),
);

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	try {
		const orderRows: OrderRow[] = CreateOrderSchema.parse(JSON.parse(req.body));

		const orderId = guidGenerator();
		const toAppend: string[][] = [];
		const coursebooks: {
			name: string;
			quantity: number;
			cost: number;
			discounted: boolean;
		}[] = [];

		orderRows.forEach((row) => {
			const temp: string[] = [
				new Date().toLocaleDateString(),
				orderId,
				row.name,
				row.email,
				row.pages?.toString() || "0",
				row.coursebookName || "",
				row.coursebookLink || "",
				row.colour.toString(),
				row.paymentMethod || "",
				row.quantity.toString(),
				row.paid?.toString() || "false",
				row.cost.toString(),
				row.message || "",
				row.discounted.toString(),
			];
			coursebooks.push({
				name: row.coursebookName || row.coursebookLink || "Unknown",
				quantity: row.quantity,
				cost: row.cost,
				discounted: row.discounted,
			});
			toAppend.push(temp);
		});

		await appendToSpreadSheet(toAppend);
		return res.json({
			message: {
				orderId: orderId,
				coursebooks: coursebooks,
			},
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
