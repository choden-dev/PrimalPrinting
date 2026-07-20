/**
 * Server-side PDF utilities.
 *
 * Page counting is used to price orders, so it must be accurate and must never
 * trust client-supplied counts. Previously this scanned the raw PDF bytes for
 * `/Type /Page` markers, but that badly overcounts real-world PDFs: the marker
 * also appears in object streams, annotations/form fields, orphaned objects
 * left by incremental updates, and even inside content streams. A 200-page PDF
 * could be counted as 467.
 *
 * We now parse the document with pdfjs-dist (already a dependency, used
 * client-side by the PdfOrder component) and read the authoritative page count
 * from the parsed document.
 */

import type * as pdfjsTypes from "pdfjs-dist";

/**
 * Raised when the pdfjs parser itself cannot be loaded/initialised — as opposed
 * to the input simply being an invalid PDF. Callers can treat this as a server
 * error (retryable) rather than telling the user their file is broken.
 */
export class PdfParserUnavailableError extends Error {
	constructor(cause: unknown) {
		super("PDF parser could not be loaded on the server", { cause });
		this.name = "PdfParserUnavailableError";
	}
}

let pdfjsPromise: Promise<typeof pdfjsTypes> | null = null;

/**
 * Lazily load pdfjs-dist's **legacy** build.
 *
 * The default entry (`pdfjs-dist`) references browser-only globals such as
 * `DOMMatrix` at module-evaluation time and throws
 * `ReferenceError: DOMMatrix is not defined` under Node — which is what the
 * server runtime (Next.js standalone server in the container) actually is. The
 * `legacy` build targets non-DOM/Node environments and avoids those globals.
 *
 * Next.js's standalone output-file tracing does not reliably follow this
 * dynamic subpath import, so the legacy build is *also* force-included via
 * `outputFileTracingIncludes` in next.config.ts. Without that, the legacy
 * build is missing from the deployed container, the import below throws, and
 * every upload is wrongly rejected as an invalid PDF.
 *
 * The load is memoised, but a failed load is NOT cached — so a transient
 * initialisation problem doesn't permanently poison every subsequent request.
 */
function getPdfjs(): Promise<typeof pdfjsTypes> {
	if (!pdfjsPromise) {
		pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs")
			.then((mod) => mod as unknown as typeof pdfjsTypes)
			.catch((err) => {
				// Don't cache the failure — allow a retry on the next call.
				pdfjsPromise = null;
				throw new PdfParserUnavailableError(err);
			});
	}
	return pdfjsPromise;
}

/**
 * Count the number of pages in a PDF by parsing it with pdfjs.
 *
 * @param buffer Raw PDF bytes.
 * @returns The authoritative page count, or 0 if the file cannot be parsed as a
 *   valid PDF (callers treat < 1 as an invalid file).
 */
export async function countPdfPages(buffer: Buffer): Promise<number> {
	// Load the parser first. A failure here means the *server* is misconfigured
	// (e.g. the pdfjs legacy build wasn't traced into the standalone bundle),
	// not that the user's file is bad — so let it propagate as a real error
	// instead of masquerading as "invalid PDF" (which returning 0 would do).
	const pdfjs = await getPdfjs();

	try {
		// pdfjs mutates the underlying buffer, so hand it a fresh copy. It also
		// expects a Uint8Array, not a Node Buffer view with a shared pool.
		const data = new Uint8Array(
			buffer.buffer.slice(
				buffer.byteOffset,
				buffer.byteOffset + buffer.byteLength,
			),
		);
		const doc = await pdfjs.getDocument({
			data,
			// Server-side hardening: don't fetch external resources, don't rely
			// on a worker thread, and avoid eval-based font handling.
			isEvalSupported: false,
			useWorkerFetch: false,
			disableFontFace: true,
		}).promise;
		const { numPages } = doc;
		await doc.destroy();
		return typeof numPages === "number" && numPages > 0 ? numPages : 0;
	} catch (err) {
		// Genuinely corrupt/encrypted/non-PDF input — signal invalid to the
		// caller. Log it so we can tell real bad files apart from unexpected
		// parser regressions.
		console.error("countPdfPages: failed to parse PDF", err);
		return 0;
	}
}
