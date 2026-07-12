import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload";

/**
 * Health / keep-warm endpoint pinged by the Worker cron (see container-worker.js)
 * to keep the scale-to-zero container and its Mongo pool warm.
 *
 * The cheap `count` query does a real round-trip so it verifies the pooled
 * socket is live (not just that the cached connection promise resolved),
 * doubling as a readiness probe that reports `db: false` when Mongo is down.
 *
 * Public (not matched by middleware.ts, which only guards /api/shop/*).
 */

// Always run dynamically on the Node runtime — never cache or prerender.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
	let db = false;
	try {
		// Warm the cached connection, then a minimal round-trip to confirm the
		// pooled socket is live. Errors are swallowed so a transient DB blip
		// never turns the keep-warm ping into a hard failure.
		const payload = await getPayloadClient();
		await payload.count({
			collection: "users",
			overrideAccess: true,
			disableErrors: true,
		});
		db = true;
	} catch (error) {
		console.warn("[health] Payload/Mongo warmup failed:", error);
	}

	return NextResponse.json(
		{ status: "ok", db, timestamp: new Date().toISOString() },
		{ headers: { "Cache-Control": "no-store" } },
	);
}
