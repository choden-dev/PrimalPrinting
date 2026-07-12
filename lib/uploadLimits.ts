/**
 * Single source of truth for customer PDF upload limits, shared by the
 * staging-urls and orders routes and Cart.tsx client validation so the
 * three sites can't drift apart. If you raise MAX_FILE_SIZE_BYTES, also
 * revisit PRESIGN_TTL_SECONDS and the orders route `maxDuration`.
 */

/** Maximum size of a single PDF the customer is allowed to upload. */
export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

/** Convenience derived constant for human-facing messages. */
export const MAX_FILE_SIZE_MB = MAX_FILE_SIZE_BYTES / 1024 / 1024;

/** Maximum number of files in a single order. */
export const MAX_FILES_PER_ORDER = 25;

/** MIME types accepted by the upload endpoints. */
export const ALLOWED_FILE_TYPES = ["application/pdf"] as const;

/**
 * Lifetime of presigned PUT URLs from /api/shop/staging-urls. Kept short
 * to limit the blast radius of a leaked URL, but long enough to upload a
 * max-size file on a slow link; the client re-requests a URL if a PUT
 * 403s after expiry. Raise this if you raise MAX_FILE_SIZE_BYTES.
 */
export const PRESIGN_TTL_SECONDS = 3 * 60;
