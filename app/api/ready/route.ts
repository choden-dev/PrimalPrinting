import { NextResponse } from "next/server";

/**
 * Ultra-light readiness probe for the Cloudflare Container port check.
 *
 * The @cloudflare/containers base class marks an instance ready on any
 * completed fetch to the ping endpoint (it ignores HTTP status), so the probe
 * must only prove the Next.js router can serve a request. This route touches
 * nothing external — unlike /api/health, whose Mongo `count()` can block past
 * the per-probe PING_TIMEOUT_MS on a cold boot and delay readiness. DB warming
 * is handled separately by instrumentation.ts and the keep-warm cron.
 *
 * Public (not matched by middleware.ts, which only guards /api/shop/*).
 */

// Always run dynamically on the Node runtime — never cache or prerender.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(): NextResponse {
	return NextResponse.json(
		{ status: "ready" },
		{ headers: { "Cache-Control": "no-store" } },
	);
}
