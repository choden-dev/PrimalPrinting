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

let pdfjsPromise: Promise<typeof pdfjsTypes> | null = null;

/**
 * Lazily load pdfjs-dist. Importing at module scope can break the Cloudflare
 * Workers runtime during bundling/SSR, so we defer to first use. The `canvas`
 * native dependency is stubbed via pnpm.overrides (see shims/canvas), which is
 * fine because we only parse the document structure here — we never render.
 */
function getPdfjs(): Promise<typeof pdfjsTypes> {
	if (!pdfjsPromise) {
		// Use the legacy build: it targets Node/non-DOM environments and does
		// not rely on browser-only globals, which suits server-side parsing.
		pdfjsPromise = import(
			"pdfjs-dist/legacy/build/pdf.mjs"
		) as unknown as Promise<typeof pdfjsTypes>;
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
	try {
		const pdfjs = await getPdfjs();
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
	} catch {
		// Corrupt/encrypted/non-PDF input — signal invalid to the caller.
		return 0;
	}
}
