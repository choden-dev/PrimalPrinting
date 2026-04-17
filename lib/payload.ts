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
 */
export const getPayloadClient = async (): Promise<Payload> => {
	if (!cachedPromise) {
		cachedPromise = Promise.race([
			getPayload({ config: configPromise }),
			new Promise<never>((_, reject) =>
				setTimeout(
					() => reject(new Error("Payload initialization timed out")),
					INIT_TIMEOUT_MS,
				),
			),
		]);
	}
	return cachedPromise;
};
