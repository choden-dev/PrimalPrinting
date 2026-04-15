import { type NextRequest, NextResponse } from "next/server";
import { getPayloadClient } from "../../../lib/payload";

/**
 * GET /api/timeslots — List available pickup timeslots.
 *
 * Returns only active timeslots with dates in the future.
 * No authentication required – customers need to see available
 * slots before selecting one.
 *
 * Query params:
 * - `limit` (number, default 50)
 */
export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const limit = Math.min(
			100,
			Math.max(1, Number(searchParams.get("limit")) || 50),
		);

		const payload = await getPayloadClient();

		const now = new Date().toISOString();

		const result = await payload.find({
			collection: "timeslots",
			where: {
				isActive: { equals: true },
				date: { greater_than_equal: now.split("T")[0] },
			},
			sort: "date",
			limit,
		});

		return NextResponse.json({
			success: true,
			timeslots: result.docs.map((slot) => ({
				id: slot.id,
				date: slot.date,
				startTime: slot.startTime,
				endTime: slot.endTime,
				label: slot.label,
			})),
		});
	} catch (error) {
		console.error("Error fetching timeslots:", error);
		return NextResponse.json(
			{ error: "Failed to fetch timeslots." },
			{ status: 500 },
		);
	}
}
