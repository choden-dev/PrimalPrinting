import type { NextRequest } from "next/server";

/**
 * Maximum total request body size we accept for any multipart upload (across
 * all files + form fields combined). Set above the per-file limits so a small
 * batch of max-size files still fits, but well below typical platform/proxy
 * limits so we can reject early with a clear message.
 *
 * /api/shop/orders        — up to 10 PDFs × 20MB = 200MB; reject above 220MB
 * /api/shop/upload-proof  — single image × 10MB                              ;
 * the cap below is the global ceiling for ANY multipart endpoint.
 */
export const MAX_MULTIPART_BODY_SIZE = 220 * 1024 * 1024; // 220MB

export type FormDataParseError = {
	message: string;
	status: number;
};

export type FormDataParseResult =
	| { ok: true; formData: FormData }
	| { ok: false; error: FormDataParseError };

/**
 * Safely parse a multipart/form-data request body.
 *
 * Wraps `request.formData()` so the generic, unhelpful
 * "Failed to parse body as FormData" error from the runtime is replaced
 * with a clear, actionable message that distinguishes the common causes:
 *
 * 1. Wrong / missing Content-Type header.
 * 2. Body exceeds our configured size limit.
 * 3. Body was truncated mid-stream (network drop, proxy timeout, client
 *    cancellation) — the multipart boundary never closed.
 * 4. Genuinely malformed multipart payload.
 *
 * @param request          The incoming Next.js request.
 * @param maxBodyBytes     Optional override for the global multipart cap.
 */
export async function parseMultipartFormData(
	request: NextRequest,
	maxBodyBytes: number = MAX_MULTIPART_BODY_SIZE,
): Promise<FormDataParseResult> {
	const contentType = request.headers.get("content-type") || "";
	if (!contentType.toLowerCase().includes("multipart/form-data")) {
		return {
			ok: false,
			error: {
				message: `Expected multipart/form-data request, received "${contentType || "no content-type"}". Make sure you submit the file using a FormData body and let the browser set the Content-Type header automatically.`,
				status: 415,
			},
		};
	}

	// Reject oversized bodies up-front using the Content-Length header so we
	// don't buffer hundreds of megabytes only to fail at the parser layer.
	// Some proxies omit Content-Length on chunked uploads; in that case we
	// fall through and rely on the per-file checks downstream.
	const contentLengthRaw = request.headers.get("content-length");
	if (contentLengthRaw) {
		const contentLength = Number.parseInt(contentLengthRaw, 10);
		if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
			const mb = (contentLength / 1024 / 1024).toFixed(1);
			const limitMb = (maxBodyBytes / 1024 / 1024).toFixed(0);
			return {
				ok: false,
				error: {
					message: `Upload too large (${mb}MB). Maximum total upload size is ${limitMb}MB. Please remove some files or compress them and try again.`,
					status: 413,
				},
			};
		}
	}

	try {
		const formData = await request.formData();
		return { ok: true, formData };
	} catch (err) {
		const rawMessage = err instanceof Error ? err.message : String(err);
		console.error("Failed to parse multipart form data:", rawMessage, err);

		// The most common cause of a runtime "Failed to parse body as FormData"
		// in production is a body that was truncated mid-stream — usually
		// because the upload exceeded an upstream proxy/CDN body limit, or the
		// client connection dropped before the closing multipart boundary was
		// transmitted. Surface that as the most likely explanation while still
		// including the underlying message for debugging.
		return {
			ok: false,
			error: {
				message:
					"We couldn't read your upload. This usually means the file(s) were too large or the upload was interrupted before completing. Please check your connection, ensure each file is within the size limit, and try again.",
				status: 400,
			},
		};
	}
}
