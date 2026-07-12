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
 * Failure handling: we cache the in-flight promise (so concurrent callers
 * share one initialisation), but if it REJECTS — e.g. a transient MongoDB
 * slowdown trips the init timeout, or a momentary network blip during a cold
 * connect — we clear the cache so the next call retries with a fresh attempt.
 * Without this, a single slow/failed cold connect would poison `cachedPromise`
 * permanently: every subsequent request (and the keep-warm ping) would get the
 * cached rejection instantly and the container could never recover until it was
 * restarted, turning a momentary blip into a hard outage.
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
