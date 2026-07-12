import type { NextRequest } from "next/server";

/**
 * Global ceiling for any multipart upload (all files + fields combined). Sized
 * above the largest endpoint (10 PDFs × 20MB) but below platform/proxy limits
 * so we can reject early with a clear message.
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
 * Safely parse a multipart/form-data request body, replacing the runtime's
 * generic "Failed to parse body as FormData" error with a clear message that
 * covers the common causes (bad Content-Type, oversized body, truncated
 * stream, malformed payload).
 *
 * @param request      The incoming Next.js request.
 * @param maxBodyBytes Optional override for the global multipart cap.
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

	// Reject oversized bodies up-front via Content-Length so we don't buffer
	// hundreds of megabytes only to fail at the parser. Chunked uploads may omit
	// the header, in which case downstream per-file checks apply.
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

		// The usual cause is a body truncated mid-stream (proxy/CDN limit or
		// dropped connection); surface that likely explanation to the user while
		// the raw message is logged above for debugging.
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
