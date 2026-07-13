import { type NextRequest, NextResponse } from "next/server";
import type { Where } from "payload";
import { isPayloadAdmin } from "../../../../lib/auth";
import { getPayloadClient } from "../../../../lib/payload";

/**
 * GET /api/admin/customers?search=...&limit=...
 *
 * Admin-only endpoint that searches customers by email or name. Used by the
 * "manually create order" admin view to pick the customer an order should be
 * created for. Returns a lightweight list — no order data.
 */

export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET(request: NextRequest) {
	if (!(await isPayloadAdmin(request))) {
		return NextResponse.json(
			{ error: "Admin access required." },
			{ status: 403 },
		);
	}

	const { searchParams } = new URL(request.url);
	const search = (searchParams.get("search") ?? "").trim();
	const limitRaw = Number.parseInt(searchParams.get("limit") ?? "20", 10);
	const limit = Number.isFinite(limitRaw)
		? Math.min(Math.max(limitRaw, 1), 50)
		: 20;

	try {
		const payload = await getPayloadClient();

		const where: Where = search
			? {
					or: [{ email: { contains: search } }, { name: { contains: search } }],
				}
			: {};

		const result = await payload.find({
			collection: "customers",
			where,
			limit,
			sort: "-createdAt",
			depth: 0,
		});

		const customers = result.docs.map((c) => ({
			id: c.id,
			email: c.email,
			name: c.name ?? "",
		}));

		return NextResponse.json({
			customers,
			total: result.totalDocs,
			limit,
		});
	} catch (error) {
		console.error("Error searching customers:", error);
		return NextResponse.json(
			{ error: "Failed to search customers." },
			{ status: 500 },
		);
	}
}
