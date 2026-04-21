/**
 * Single source of truth for customer PDF upload limits.
 *
 * These constants are consumed by:
 *   - app/api/shop/staging-urls/route.ts  (issues presigned PUT URLs)
 *   - app/api/shop/orders/route.ts        (finalises the DRAFT order)
 *   - components/ordercontainer/Cart.tsx  (client-side validation)
 *
 * Keeping them in one module prevents the three sites from drifting apart
 * (e.g. server enforcing 20MB while the client tells the user it's 50MB).
 *
 * If you change MAX_FILE_SIZE_BYTES, also reconsider:
 *   - PRESIGN_TTL_SECONDS — a slow connection on a near-cap file may need
 *     more than the default to finish the PUT before the URL expires.
 *   - The `maxDuration` on the orders route — finalise downloads every
 *     file from R2 to count pages authoritatively, so total bytes ×
 *     download bandwidth must comfortably fit.
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
 * Lifetime of presigned PUT URLs issued by /api/shop/staging-urls.
 *
 * Kept deliberately short to limit the blast radius if a URL leaks (e.g.
 * via browser history, shared logs, or a tampered client). 3 minutes is
 * comfortable for the median real-world upload:
 *   - 100 MB at 10 Mbps (≈1.25 MB/s) ≈ 80s
 *   - 100 MB at 5  Mbps (≈0.6  MB/s) ≈ 165s — still inside the window
 *
 * Customers on slower connections (rural / mobile) uploading near-cap
 * files may need a fresh URL — the client surfaces a clear retry prompt
 * if a signed PUT 403s after expiry.
 *
 * Trade-off: if you raise MAX_FILE_SIZE_BYTES in the future, also raise
 * this — a max-size file must be able to upload comfortably within one
 * TTL window even on a slow link.
 */
export const PRESIGN_TTL_SECONDS = 3 * 60;
