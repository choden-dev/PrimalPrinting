/**
 * Next.js instrumentation hook.
 *
 * `register()` is invoked exactly once when the server process boots — before
 * any request is handled. We use it to eagerly warm the Payload CMS / MongoDB
 * connection so the FIRST visitor after a cold container start doesn't pay the
 * full connect + Mongoose model-registration cost inline with their request.
 *
 * Background: this app runs as a standalone Next.js server inside a Cloudflare
 * Container that can scale to zero. When it spins back up, the very first
 * request would otherwise trigger `getPayloadClient()` for the first time,
 * incurring the MongoDB handshake and Payload initialisation on the critical
 * path — the source of the very long / timeout-prone loads reported for that
 * first user. Warming here overlaps that cost with the server's own boot.
 *
 * The warmup is:
 *   - Node.js runtime only (skipped on the Edge runtime, which has no Mongo).
 *   - Fire-and-forget: it never blocks server startup and swallows errors so a
 *     transient DB hiccup at boot can't crash the process. `getPayloadClient`
 *     caches its promise, so the first real request simply awaits the same
 *     (already in-flight or resolved) connection.
 */
export async function register(): Promise<void> {
	// Only warm on the Node.js server runtime — the Edge runtime cannot talk to
	// MongoDB and has no access to the Payload local API.
	if (process.env.NEXT_RUNTIME !== "nodejs") {
		return;
	}

	// Skip if there is no database configured (e.g. build/CI environments) to
	// avoid a pointless 5s serverSelectionTimeout at boot.
	if (!process.env.DATABASE_URI) {
		return;
	}

	try {
		const { getPayloadClient } = await import("./lib/payload");
		// Fire-and-forget: kick off initialisation but don't block boot on it.
		void getPayloadClient().catch((error) => {
			console.warn("[instrumentation] Payload warmup failed:", error);
		});
	} catch (error) {
		console.warn("[instrumentation] Payload warmup could not start:", error);
	}
}
