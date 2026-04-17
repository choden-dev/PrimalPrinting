import type { Payload } from "payload";
import { getPayload } from "payload";
import configPromise from "../payload.config";

/** Timeout (ms) for Payload initialisation — prevents Workers from hanging. */
const INIT_TIMEOUT_MS = 15_000;

/**
 * Eagerly start Payload initialization at module-load time.
 *
 * On Cloudflare Workers the first request after a cold start must wait for
 * Payload + MongoDB to initialise. By kicking this off at import time the
 * connection is established in parallel with request routing, which greatly
 * reduces (or eliminates) the cold-start penalty for the first request.
 *
 * A timeout wrapper ensures the Worker never hangs indefinitely if the
 * database is unreachable.
 */
const payloadPromise: Promise<Payload> = Promise.race([
	getPayload({ config: configPromise }),
	new Promise<never>((_, reject) =>
		setTimeout(
			() => reject(new Error("Payload initialization timed out")),
			INIT_TIMEOUT_MS,
		),
	),
]);

/**
 * Returns a cached Payload CMS client instance.
 * Uses the Payload Local API for server-side data fetching.
 *
 * The first call awaits the eagerly-started initialisation promise;
 * subsequent calls return the already-resolved instance immediately.
 */
export const getPayloadClient = async (): Promise<Payload> => {
	return payloadPromise;
};
