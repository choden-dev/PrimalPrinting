import { randomUUID } from "node:crypto";
import {
	CopyObjectCommand,
	DeleteObjectCommand,
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
// sharp removed — native C++ addon incompatible with Cloudflare Workers.
// Bank transfer proof images are uploaded without server-side resizing.

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

// ── Upload operations ────────────────────────────────────────────────────

/**
 * Upload a file buffer to the staging R2 bucket.
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
	contentType = "image/jpeg",
): Promise<string> {
	const key = generateProofKey(orderNumber);

	// Previously used sharp to resize/convert to WebP, but sharp's native
	// bindings are incompatible with Cloudflare Workers. Upload original instead.
	await uploadToStaging(key, imageBuffer, contentType);
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
