/**
 * Next.js instrumentation hook. `register()` runs once at server boot, before
 * any request. We warm the Payload/MongoDB connection here so the first visitor
 * after a cold container start (Cloudflare Containers scale to zero) doesn't pay
 * the connect + model-registration cost inline with their request.
 *
 * Fire-and-forget: never blocks boot and swallows errors; `getPayloadClient`
 * caches its promise so the first real request awaits the same connection.
 */
export async function register(): Promise<void> {
	// Skip on the Edge runtime (no Mongo). Check for an explicit "edge" value
	// rather than `=== "nodejs"` so an unset NEXT_RUNTIME still warms by default.
	if (process.env.NEXT_RUNTIME === "edge") {
		return;
	}

	// Skip without a DB (e.g. build/CI) to avoid a pointless serverSelectionTimeout.
	if (!process.env.DATABASE_URI) {
		return;
	}

	try {
		const { getPayloadClient } = await import("./lib/payload");
		void getPayloadClient().catch((error) => {
			console.warn("[instrumentation] Payload warmup failed:", error);
		});
	} catch (error) {
		console.warn("[instrumentation] Payload warmup could not start:", error);
	}
}
