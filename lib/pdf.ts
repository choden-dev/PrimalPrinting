/**
 * Server-side PDF utilities.
 *
 * Page counting is used to price orders, so it must be accurate and must never
 * trust client-supplied counts.
 *
 * History:
 *  - Originally this scanned the raw PDF bytes for `/Type /Page` markers, which
 *    badly overcounts real-world PDFs — the marker also appears in object
 *    streams, annotations/form fields, orphaned objects left by incremental
 *    updates, and inside content streams. A 200-page PDF was counted as 467.
 *  - We then tried pdfjs-dist, but its default build references browser-only
 *    globals (`DOMMatrix`) and crashes under Node, and its legacy build was
 *    unreliable to trace into the Next.js standalone/container bundle — causing
 *    valid PDFs to be rejected as invalid in production.
 *
 * We now use `pdf-lib`: a dependency-free, pure-TypeScript PDF library that runs
 * anywhere Node runs (no native addons, no DOM globals, no web worker, no
 * bundler/file-tracing special-casing). It parses the document object graph and
 * exposes an authoritative page count.
 */

import { PDFDocument } from "pdf-lib";

/**
 * Count the number of pages in a PDF by parsing its structure.
 *
 * @param buffer Raw PDF bytes.
 * @returns The authoritative page count, or 0 if the file cannot be parsed as a
 *   valid PDF (callers treat < 1 as an invalid file).
 */
export async function countPdfPages(buffer: Buffer): Promise<number> {
	try {
		const doc = await PDFDocument.load(buffer, {
			// We only need the page count, so skip the extra work of parsing all
			// form fields, and don't refuse encrypted PDFs — a customer may well
			// upload a password/permission-protected PDF and we can still read
			// its page count without decrypting the content streams.
			ignoreEncryption: true,
			updateMetadata: false,
		});
		const numPages = doc.getPageCount();
		return typeof numPages === "number" && numPages > 0 ? numPages : 0;
	} catch (err) {
		// Corrupt / non-PDF input — signal invalid to the caller. Log it so a
		// genuine bad file can be told apart from an unexpected parser
		// regression.
		console.error("countPdfPages: failed to parse PDF", err);
		return 0;
	}
}
