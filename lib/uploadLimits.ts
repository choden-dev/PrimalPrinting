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
 * Sized to comfortably accommodate uploading a max-size file on a slow
 * NZ home connection (~10 Mbps): 100 MB at 1 MB/s ≈ 100s, so 15 min gives
 * a generous safety margin and lets retries happen within a single TTL.
 */
export const PRESIGN_TTL_SECONDS = 15 * 60;
