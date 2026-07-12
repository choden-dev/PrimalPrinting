import { NextResponse } from "next/server";

/**
 * Ultra-light readiness probe for the Cloudflare Container port check.
 *
 * WHY THIS EXISTS (separate from /api/health):
 * The @cloudflare/containers base class decides a (re)started instance is
 * "ready" to receive proxied traffic by doing `tcpPort.fetch("http://<pingEndpoint>")`
 * and treating ANY completed fetch (no thrown error) as ready — it does NOT
 * inspect the HTTP status. So the ONLY thing that matters for readiness is that
 * the Next.js router can complete a request end-to-end.
 *
 * `/api/health` is deliberately NOT suitable as that probe target: it calls
 * `getPayloadClient()` and issues a MongoDB `count()`. On a cold boot Mongo may
 * not be connected yet, so that route can block up to the driver's
 * serverSelectionTimeout — which can EXCEED the library's per-probe
 * `PING_TIMEOUT_MS` (5s). Each probe attempt would then time out and be
 * retried, DELAYING the moment the container is marked ready and eating into
 * the port-ready budget — the very thing that surfaces as
 *   "Error proxying request to container: Container is taking too long to
 *    accept the connection; the application could be overwhelmed with load".
 *
 * This route touches NOTHING external — no DB, no Payload, no I/O. It only
 * proves the standalone Next.js server has finished booting enough to route a
 * request and return a response, which is exactly (and only) what the
 * container port-readiness check needs. Mongo/Payload warming is handled
 * independently by instrumentation.ts (boot-time) and the keep-warm cron via
 * /api/health, so readiness and DB-warmth stay decoupled.
 *
 * Kept public (not matched by middleware.ts, which only guards /api/shop/*).
 */

// Always run dynamically on the Node runtime — never cache or prerender, so
// the probe reflects the live server rather than a static response.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(): NextResponse {
	return NextResponse.json(
		{ status: "ready" },
		{ headers: { "Cache-Control": "no-store" } },
	);
}
