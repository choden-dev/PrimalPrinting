import { type NextRequest, NextResponse } from "next/server";
import { getPayloadClient } from "../../../../lib/payload";
import {
	generateTimeslotsForSchedule,
	type ScheduleDoc,
} from "../../../../lib/scheduleGenerator";

/**
 * POST /api/admin/generate-timeslots
 *
 * Admin-only endpoint to manually trigger timeslot generation for a schedule.
 * Useful for previewing what will be created or forcing a refresh.
 *
 * Body: `{ "scheduleId": "..." }`
 * If no scheduleId is provided, generates for all active schedules.
 */
export async function POST(request: NextRequest) {
	try {
		const payload = await getPayloadClient();

		// Verify admin auth
		const { user } = await payload.auth({ headers: request.headers });
		if (!user) {
			return NextResponse.json(
				{ error: "Admin authentication required." },
				{ status: 401 },
			);
		}

		const body = await request.json().catch(() => ({}));
		const { scheduleId } = body as { scheduleId?: string };

		const results: {
			scheduleId: string;
			scheduleName: string;
			created: number;
			deactivated: number;
			unchanged: number;
		}[] = [];

		if (scheduleId) {
			// Generate for a specific schedule
			const schedule = await payload.findByID({
				collection: "schedules",
				id: scheduleId,
			});

			if (!schedule) {
				return NextResponse.json(
					{ error: "Schedule not found." },
					{ status: 404 },
				);
			}

			const result = await generateTimeslotsForSchedule(
				schedule as ScheduleDoc,
			);
			results.push({
				scheduleId: String(schedule.id),
				scheduleName: schedule.name,
				...result,
			});
		} else {
			// Generate for all active schedules
			const { docs: schedules } = await payload.find({
				collection: "schedules",
				where: { isActive: { equals: true } },
				limit: 0,
			});

			for (const schedule of schedules) {
				try {
					const result = await generateTimeslotsForSchedule(
						schedule as ScheduleDoc,
					);
					results.push({
						scheduleId: String(schedule.id),
						scheduleName: schedule.name,
						...result,
					});
				} catch (error) {
					console.error(
						`Failed to generate timeslots for schedule ${schedule.id}:`,
						error,
					);
					results.push({
						scheduleId: String(schedule.id),
						scheduleName: schedule.name,
						created: 0,
						deactivated: 0,
						unchanged: 0,
					});
				}
			}
		}

		return NextResponse.json({
			success: true,
			results,
			message: `Processed ${results.length} schedule(s).`,
		});
	} catch (error) {
		console.error("Error generating timeslots:", error);
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to generate timeslots.",
			},
			{ status: 500 },
		);
	}
}
