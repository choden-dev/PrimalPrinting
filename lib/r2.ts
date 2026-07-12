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
 * Customer-scoped staging key for direct browser uploads via presigned PUT.
 * Format: `staging/<customerId>/<uuid>-<sanitisedFilename>`.
 * The customerId prefix lets finalisation verify ownership without trusting
 * client-supplied data — a client can only claim keys under its own prefix.
 */
export function generateCustomerStagingKey(
	customerId: string,
	originalFileName: string,
): string {
	// Sanitise the customer ID out of caution (slashes, control chars).
	const safeCustomerId = String(customerId).replace(/[^a-zA-Z0-9._-]/g, "_");
	const sanitised = originalFileName.replace(/[^a-zA-Z0-9._-]/g, "_");
	return `staging/${safeCustomerId}/${randomUUID()}-${sanitised}`;
}

/**
 * Returns true if the given staging key was generated for the given customer
 * by `generateCustomerStagingKey`. Used to gate access during finalisation.
 */
export function isCustomerStagingKey(key: string, customerId: string): boolean {
	const safeCustomerId = String(customerId).replace(/[^a-zA-Z0-9._-]/g, "_");
	return key.startsWith(`staging/${safeCustomerId}/`);
}

/** Permanent key for a staging key — same path structure, different bucket. */
export function generatePermanentKey(stagingKey: string): string {
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

/** Upload a bank transfer proof image to the staging bucket. */
export async function uploadBankTransferProof(
	orderNumber: string,
	imageBuffer: Buffer | Uint8Array,
	contentType = "image/jpeg",
): Promise<string> {
	const key = generateProofKey(orderNumber);

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

/**
 * Pre-signed URL for uploading (PUT) a file directly from the browser to the
 * staging bucket. The PUT must send a matching `Content-Type` header for the
 * signature to validate. Kept short-lived to limit exposure if it leaks.
 */
export async function getPresignedUploadUrl(
	key: string,
	contentType: string,
	options?: { expiresIn?: number },
): Promise<string> {
	const client = getS3Client();
	const expiresIn = options?.expiresIn ?? 5 * 60; // 5 minutes default

	const command = new PutObjectCommand({
		Bucket: getStagingBucket(),
		Key: key,
		ContentType: contentType,
	});

	return getSignedUrl(client, command, { expiresIn });
}

// ── Read operations ──────────────────────────────────────────────────────

/**
 * HEAD a staging object, returning its size + content-type, or `null` if it
 * doesn't exist. Used during finalisation to verify a client-supplied key
 * corresponds to a successfully-uploaded object.
 */
export async function headStagingObject(
	key: string,
): Promise<{ contentLength: number; contentType: string } | null> {
	const client = getS3Client();
	try {
		const result = await client.send(
			new HeadObjectCommand({
				Bucket: getStagingBucket(),
				Key: key,
			}),
		);
		return {
			contentLength: result.ContentLength ?? 0,
			contentType: result.ContentType ?? "application/octet-stream",
		};
	} catch (err) {
		const status = (err as { $metadata?: { httpStatusCode?: number } })
			?.$metadata?.httpStatusCode;
		if (status === 404 || status === 403) return null;
		throw err;
	}
}

/**
 * Download an object from the staging bucket as a Buffer. Used by the
 * order-finalisation endpoint to read the uploaded PDF for page counting.
 */
export async function downloadFromStaging(key: string): Promise<Buffer> {
	const client = getS3Client();
	const result = await client.send(
		new GetObjectCommand({
			Bucket: getStagingBucket(),
			Key: key,
		}),
	);

	if (!result.Body) {
		throw new Error(`Staging object ${key} has no body.`);
	}

	// SDK v3 body type varies by runtime; transformToByteArray is the
	// cross-runtime helper for reading the whole body into memory.
	const bytes = await (
		result.Body as { transformToByteArray: () => Promise<Uint8Array> }
	).transformToByteArray();
	return Buffer.from(bytes);
}
