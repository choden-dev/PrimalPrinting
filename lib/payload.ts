import type { Payload } from "payload";
import { getPayload } from "payload";
import configPromise from "../payload.config";

let cachedPayload: Payload | null = null;

/**
 * Returns a cached Payload CMS client instance.
 * Uses the Payload Local API for server-side data fetching.
 */
export const getPayloadClient = async (): Promise<Payload> => {
	if (cachedPayload) {
		return cachedPayload;
	}

	cachedPayload = await getPayload({ config: configPromise });
	return cachedPayload;
};
