import type { Payload } from "payload";
import { getPayload } from "payload";
import configPromise from "../payload.config";

/** Timeout (ms) for Payload initialisation — prevents Workers from hanging. */
const INIT_TIMEOUT_MS = 15_000;

let cachedPromise: Promise<Payload> | null = null;

/**
 * Returns a cached Payload CMS client instance.
 * Uses the Payload Local API for server-side data fetching.
 *
 * Initialization is deferred to the first call (not module-load time) because
 * on Cloudflare Workers, environment variables (secrets) are only populated
 * into process.env when the first request arrives. Initializing at import
 * time would see an empty DATABASE_URI and hang or fail.
 *
 * A timeout wrapper ensures the Worker never hangs indefinitely if the
 * database is unreachable.
 *
 * We cache the in-flight promise so concurrent callers share one
 * initialisation, but clear the cache if it rejects — otherwise a single
 * failed cold connect would poison the cache permanently and turn a momentary
 * blip into a hard outage that only a restart could fix.
 */
export const getPayloadClient = async (): Promise<Payload> => {
	if (!cachedPromise) {
		const attempt = Promise.race([
			getPayload({ config: configPromise }),
			new Promise<never>((_, reject) =>
				setTimeout(
					() => reject(new Error("Payload initialization timed out")),
					INIT_TIMEOUT_MS,
				),
			),
		]);
		// Only keep the cache if initialisation succeeds. On failure, drop it
		// so a later request/ping can retry instead of being served a
		// permanently-cached rejection.
		attempt.catch(() => {
			if (cachedPromise === attempt) {
				cachedPromise = null;
			}
		});
		cachedPromise = attempt;
	}
	return cachedPromise;
};
