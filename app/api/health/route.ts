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
 * server. It then issues ONE deliberately cheap query (a collection `count`)
 * against MongoDB.
 *
 * Why run a query at all? Warming `getPayloadClient()` only proves the cached
 * connection *promise* resolved — it does not prove the underlying pooled
 * socket is still alive and the database is actually reachable. A minimal
 * round-trip both (a) exercises a real pinned socket so the keep-warm cron
 * genuinely keeps the connection hot end-to-end, and (b) turns this endpoint
 * into a true readiness probe that reports `db: false` when MongoDB is down
 * instead of a false `db: true` on a stale connection. The `count` bypasses
 * access control (`overrideAccess`) and never fetches document bodies — it
 * only asks MongoDB for a collection count, which is a cheap round-trip that
 * still touches the wire.
 *
 * Kept public (not matched by middleware.ts, which only guards /api/shop/*).
 */

// Always run dynamically on the Node runtime — never cache or prerender.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
	let db = false;
	try {
		// Warms (and reuses) the cached Payload/Mongo connection, then does a
		// minimal round-trip to confirm the pooled socket is actually live.
		// Swallow errors so a transient DB blip never turns the keep-warm ping
		// into a hard failure that could mark the container unhealthy.
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
