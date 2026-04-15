/**
 * Cloudflare Worker: PDF Page Count Processor
 *
 * Consumes messages from the pdf-page-count queue. Each message contains
 * an R2 staging key for a PDF. The worker:
 *
 * 1. Downloads the PDF from the staging R2 bucket
 * 2. Counts the pages (by scanning for /Type /Page markers)
 * 3. Re-uploads the object with a `page-count` custom metadata field
 *
 * This avoids doing expensive PDF parsing in the main app's request path.
 */

interface Env {
	STAGING_BUCKET: R2Bucket;
}

interface QueueMessage {
	stagingKey: string;
}

/**
 * Count PDF pages by scanning the raw bytes for /Type /Page patterns.
 * This is a lightweight approach that doesn't require a full PDF parser
 * — it works for 99%+ of well-formed PDFs and runs efficiently in Workers.
 */
function countPdfPages(data: ArrayBuffer): number {
	const bytes = new Uint8Array(data);
	const text = new TextDecoder("latin1").decode(bytes);

	// Count occurrences of "/Type /Page" but not "/Type /Pages" (the parent)
	// The regex matches /Type followed by optional whitespace and /Page
	// but not /Pages
	let count = 0;
	let pos = 0;
	while (true) {
		const idx = text.indexOf("/Type", pos);
		if (idx === -1) break;

		// Look ahead past whitespace for /Page
		const after = text.substring(idx + 5, idx + 30).trimStart();
		if (after.startsWith("/Page") && !after.startsWith("/Pages")) {
			count++;
		}
		pos = idx + 5;
	}

	return Math.max(count, 1); // at least 1 page
}

export default {
	async queue(
		batch: MessageBatch<QueueMessage>,
		env: Env,
	): Promise<void> {
		for (const message of batch.messages) {
			const { stagingKey } = message.body;

			try {
				// Download the PDF from R2
				const object = await env.STAGING_BUCKET.get(stagingKey);
				if (!object) {
					console.error(`Object not found: ${stagingKey}`);
					message.ack();
					continue;
				}

				// Count pages
				const data = await object.arrayBuffer();
				const pageCount = countPdfPages(data);

				// Re-upload with the same body + page-count metadata
				await env.STAGING_BUCKET.put(stagingKey, data, {
					httpMetadata: object.httpMetadata,
					customMetadata: {
						...object.customMetadata,
						"page-count": String(pageCount),
					},
				});

				console.log(`Processed ${stagingKey}: ${pageCount} pages`);
				message.ack();
			} catch (err) {
				console.error(`Failed to process ${stagingKey}:`, err);
				message.retry();
			}
		}
	},
};
