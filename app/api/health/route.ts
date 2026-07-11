import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload";

/**
 * Lightweight health / keep-warm endpoint.
 *
 * Purpose: this app runs inside a Cloudflare Container that scales to zero.
 * A scheduled Worker Cron Trigger (see the `scheduled` handler in
 * container-worker.js) pings this route periodically so the container stays
 * running with an already-established MongoDB connection pool. That way real
 * visitors reuse a warm process instead of paying the container boot +
 * Next.js start + Mongo connect/init on their first request.
 *
 * The route touches `getPayloadClient()` (which caches its connection promise)
 * so the ping also keeps the Payload/Mongo layer warm, not just the HTTP
 * server. It is intentionally cheap: it does not run any queries.
 *
 * Kept public (not matched by middleware.ts, which only guards /api/shop/*).
 */

// Always run dynamically on the Node runtime — never cache or prerender.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
	let db = false;
	try {
		// Warms (and reuses) the cached Payload/Mongo connection. Swallow
		// errors so a transient DB blip never turns the keep-warm ping into a
		// hard failure that could mark the container unhealthy.
		await getPayloadClient();
		db = true;
	} catch (error) {
		console.warn("[health] Payload/Mongo warmup failed:", error);
	}

	return NextResponse.json(
		{ status: "ok", db, timestamp: new Date().toISOString() },
		{ headers: { "Cache-Control": "no-store" } },
	);
}
