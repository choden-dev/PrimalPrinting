import { randomUUID } from "node:crypto";
import {
	CopyObjectCommand,
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import pdfParse from "pdf-parse";
import sharp from "sharp";

// ── S3-compatible client (shared across all R2 buckets) ──────────────────

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
	if (s3Client) return s3Client;

	s3Client = new S3Client({
		endpoint: process.env.R2_S3_ENDPOINT,
		credentials: {
			accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
			secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
		},
		region: "auto",
		forcePathStyle: true,
	});

	return s3Client;
}

// ── Bucket helpers ───────────────────────────────────────────────────────

function getStagingBucket(): string {
	return process.env.R2_STAGING_BUCKET || "primalprinting-staging";
}

function getPermanentBucket(): string {
	return process.env.R2_PERMANENT_BUCKET || "primalprinting-orders";
}

// ── Key generators ───────────────────────────────────────────────────────

/**
 * Generate a unique staging key for an order file.
 * Format: `orders/<orderId>/<uuid>-<sanitisedFilename>`
 */
export function generateStagingKey(
	orderNumber: string,
	originalFileName: string,
): string {
	const sanitised = originalFileName.replace(/[^a-zA-Z0-9._-]/g, "_");
	return `orders/${orderNumber}/${randomUUID()}-${sanitised}`;
}

/**
 * Generate a permanent key from a staging key.
 * Keeps the same path structure but lives in the permanent bucket.
 */
export function generatePermanentKey(stagingKey: string): string {
	// Same key structure — different bucket
	return stagingKey;
}

/**
 * Generate a key for a bank transfer proof image.
 * Format: `proofs/<orderNumber>/<uuid>.webp`
 */
export function generateProofKey(orderNumber: string): string {
	return `proofs/${orderNumber}/${randomUUID()}.webp`;
}

// ── PDF page counting ────────────────────────────────────────────────────

/**
 * Get the verified page count for a staged PDF.
 *
 * 1. Polls R2 metadata (set by the queue worker) with retries
 * 2. Falls back to downloading and parsing the PDF if queue hasn't processed yet
 * 3. Never returns a client-provided value
 *
 * Returns null only if the file is inaccessible or unparseable.
 */
export async function getVerifiedPageCount(
	stagingKey: string,
	options?: { maxRetries?: number; retryDelayMs?: number },
): Promise<number | null> {
	const client = getS3Client();
	const maxRetries = options?.maxRetries ?? 5;
	const retryDelayMs = options?.retryDelayMs ?? 1000;

	// Poll metadata with retries (queue worker may still be processing)
	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			const headResponse = await client.send(
				new HeadObjectCommand({
					Bucket: getStagingBucket(),
					Key: stagingKey,
				}),
			);
			const pageCountStr = headResponse.Metadata?.["page-count"];
			if (pageCountStr) {
				const parsed = Number.parseInt(pageCountStr, 10);
				if (!Number.isNaN(parsed) && parsed > 0) return parsed;
			}
		} catch (err) {
			console.error(
				`HeadObject attempt ${attempt + 1} failed for`,
				stagingKey,
				err,
			);
		}

		// Wait before retrying (queue worker might still be processing)
		if (attempt < maxRetries - 1) {
			await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
		}
	}

	// Fallback: download and parse the PDF directly
	console.warn(
		`Queue hasn't processed ${stagingKey} after ${maxRetries} retries, falling back to direct parse`,
	);
	try {
		const getResponse = await client.send(
			new GetObjectCommand({
				Bucket: getStagingBucket(),
				Key: stagingKey,
			}),
		);

		const chunks: Uint8Array[] = [];
		const stream = getResponse.Body as AsyncIterable<Uint8Array>;
		for await (const chunk of stream) {
			chunks.push(chunk);
		}

		const parsed = await pdfParse(Buffer.concat(chunks));
		return parsed.numpages;
	} catch (err) {
		console.error("Failed to parse PDF for page count:", stagingKey, err);
	}

	return null;
}

// ── Upload operations ────────────────────────────────────────────────────

/**
 * Upload a file buffer to the staging R2 bucket.
 * If the file is a PDF, a message is pushed to the processing queue
 * for async page counting — no inline parsing.
 */
export async function uploadToStaging(
	key: string,
	body: Buffer | Uint8Array,
	contentType: string,
): Promise<void> {
	const client = getS3Client();

	await client.send(
		new PutObjectCommand({
			Bucket: getStagingBucket(),
			Key: key,
			Body: body,
			ContentType: contentType,
		}),
	);

	// Push to processing queue for async page counting
	if (contentType === "application/pdf") {
		await pushToPageCountQueue(key);
	}
}

/**
 * Push a message to the Cloudflare Queue for async PDF page counting.
 */
async function pushToPageCountQueue(stagingKey: string): Promise<void> {
	const queueUrl = process.env.CF_QUEUE_URL;
	const queueToken = process.env.CF_QUEUE_TOKEN;

	if (!queueUrl || !queueToken) {
		console.warn(
			"CF_QUEUE_URL or CF_QUEUE_TOKEN not set — skipping queue push for",
			stagingKey,
		);
		return;
	}

	try {
		const res = await fetch(queueUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${queueToken}`,
			},
			body: JSON.stringify({
				messages: [{ body: { stagingKey } }],
			}),
		});

		if (!res.ok) {
			console.error("Failed to push to queue:", res.status, await res.text());
		}
	} catch (err) {
		console.error("Queue push error:", err);
	}
}

/**
 * Upload a bank transfer proof image to the staging bucket.
 *
 * The image is automatically downsized to a max width of 1200px and
 * converted to WebP at 70% quality to prevent abuse / save storage.
 */
export async function uploadBankTransferProof(
	orderNumber: string,
	imageBuffer: Buffer | Uint8Array,
): Promise<string> {
	const key = generateProofKey(orderNumber);

	// Downsize & convert to WebP
	const processed = await sharp(imageBuffer)
		.resize({ width: 1200, withoutEnlargement: true })
		.webp({ quality: 70 })
		.toBuffer();

	await uploadToStaging(key, processed, "image/webp");
	return key;
}

// ── Transfer operations ──────────────────────────────────────────────────

/**
 * Copy a single object from the staging bucket to the permanent bucket.
 * Returns the permanent key.
 */
export async function transferToPermanent(stagingKey: string): Promise<string> {
	const client = getS3Client();
	const permanentKey = generatePermanentKey(stagingKey);

	await client.send(
		new CopyObjectCommand({
			Bucket: getPermanentBucket(),
			Key: permanentKey,
			CopySource: `${getStagingBucket()}/${stagingKey}`,
		}),
	);

	return permanentKey;
}

/**
 * Transfer all files for an order from staging → permanent.
 * Returns a map of stagingKey → permanentKey.
 */
export async function transferOrderFiles(
	files: { stagingKey: string }[],
): Promise<Map<string, string>> {
	const results = new Map<string, string>();

	await Promise.all(
		files.map(async (file) => {
			const permanentKey = await transferToPermanent(file.stagingKey);
			results.set(file.stagingKey, permanentKey);
		}),
	);

	return results;
}

// ── Cleanup operations ───────────────────────────────────────────────────

/**
 * Delete a single object from the staging bucket.
 */
export async function deleteFromStaging(key: string): Promise<void> {
	const client = getS3Client();
	await client.send(
		new DeleteObjectCommand({
			Bucket: getStagingBucket(),
			Key: key,
		}),
	);
}

/**
 * Delete a single object from the permanent bucket.
 */
export async function deleteFromPermanent(key: string): Promise<void> {
	const client = getS3Client();
	await client.send(
		new DeleteObjectCommand({
			Bucket: getPermanentBucket(),
			Key: key,
		}),
	);
}

/**
 * Delete all staging files for an order.
 */
export async function cleanupStagingFiles(
	files: { stagingKey: string }[],
): Promise<void> {
	await Promise.all(files.map((file) => deleteFromStaging(file.stagingKey)));
}

// ── Signed URL generation ────────────────────────────────────────────────

/**
 * Generate a pre-signed URL for downloading / viewing a file.
 * Defaults to the permanent bucket; pass `staging: true` for the staging bucket.
 */
export async function getPresignedUrl(
	key: string,
	options?: { staging?: boolean; expiresIn?: number },
): Promise<string> {
	const client = getS3Client();
	const bucket = options?.staging ? getStagingBucket() : getPermanentBucket();
	const expiresIn = options?.expiresIn ?? 3600; // 1 hour default

	const command = new GetObjectCommand({
		Bucket: bucket,
		Key: key,
	});

	return getSignedUrl(client, command, { expiresIn });
}
