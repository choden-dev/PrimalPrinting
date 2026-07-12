#!/usr/bin/env tsx
/**
 * Mirror `.next/static/**` → `_next/static/**` and `public/**` → `**` into the
 * R2 "assets" bucket so the standalone server runs headless (origin set via
 * NEXT_PUBLIC_ASSET_PREFIX). Requires R2_ASSETS_BUCKET, R2_S3_ENDPOINT,
 * R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY; optional ASSETS_CACHE_CONTROL,
 * ASSETS_PUBLIC_CACHE_CONTROL, ASSETS_CONCURRENCY, ASSETS_DRY_RUN. Writes
 * `.next/asset-upload.manifest.json` as Turbo's cached output.
 */

import { createReadStream, type Dirent } from "node:fs";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { extname, join, posix, relative, resolve, sep } from "node:path";
import process from "node:process";

import {
	DeleteObjectsCommand,
	GetObjectCommand,
	HeadObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client,
	type S3ServiceException,
} from "@aws-sdk/client-s3";

// ── Configuration ──────────────────────────────────────────────────────────
const REPO_ROOT = resolve(process.cwd());
const NEXT_STATIC_DIR = join(REPO_ROOT, ".next", "static");
const PUBLIC_DIR = join(REPO_ROOT, "public");
const MANIFEST_PATH = join(REPO_ROOT, ".next", "asset-upload.manifest.json");

// Previous deploy's manifest, stored in-bucket so the script is self-contained
// (any runner with R2 creds can deploy). `_meta/` keeps it off asset paths.
const PREVIOUS_MANIFEST_KEY = "_meta/asset-upload.manifest.previous.json";

// Only prune under this prefix; leave `public/**` and `_meta/` alone.
const PRUNE_PREFIX = "_next/static/";

// DeleteObjects allows 1000 keys/request; 500 leaves headroom for XML overhead.
const DELETE_BATCH_SIZE = 500;

const IMMUTABLE_CACHE_CONTROL =
	process.env.ASSETS_CACHE_CONTROL ?? "public, max-age=31536000, immutable";
const PUBLIC_CACHE_CONTROL =
	process.env.ASSETS_PUBLIC_CACHE_CONTROL ?? "public, max-age=3600";

const CONCURRENCY = Math.max(
	1,
	Number.parseInt(process.env.ASSETS_CONCURRENCY ?? "16", 10) || 16,
);
const DRY_RUN = process.env.ASSETS_DRY_RUN === "1";

// Minimal extension → MIME map. We deliberately keep this small; the bulk of
// `.next/static` is .js / .css / .map / .woff2.
const MIME_TYPES: Record<string, string> = {
	".css": "text/css; charset=utf-8",
	".gif": "image/gif",
	".html": "text/html; charset=utf-8",
	".ico": "image/x-icon",
	".jpeg": "image/jpeg",
	".jpg": "image/jpeg",
	".js": "application/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".map": "application/json; charset=utf-8",
	".mjs": "application/javascript; charset=utf-8",
	".otf": "font/otf",
	".pdf": "application/pdf",
	".png": "image/png",
	".svg": "image/svg+xml",
	".ttf": "font/ttf",
	".txt": "text/plain; charset=utf-8",
	".webmanifest": "application/manifest+json",
	".webp": "image/webp",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".xml": "application/xml; charset=utf-8",
};

function mimeFor(filename: string): string {
	return (
		MIME_TYPES[extname(filename).toLowerCase()] ?? "application/octet-stream"
	);
}

// ── Env validation ─────────────────────────────────────────────────────────
function requireEnv(name: string): string {
	const v = process.env[name];
	if (!v || v.trim() === "") {
		console.error(`✗ Missing required env var: ${name}`);
		process.exit(1);
	}
	return v;
}

const BUCKET = requireEnv("R2_ASSETS_BUCKET");
const ENDPOINT = requireEnv("R2_S3_ENDPOINT");
const ACCESS_KEY = requireEnv("R2_ACCESS_KEY_ID");
const SECRET_KEY = requireEnv("R2_SECRET_ACCESS_KEY");

// ── S3 client (R2 is S3-compatible) ────────────────────────────────────────
// Checksum opts pinned to "WHEN_REQUIRED": R2 rejects the flexible-checksum
// framing aws-sdk-js v3 enables by default (>=v3.730), failing every PutObject.
// See: https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/
const s3 = new S3Client({
	region: "auto",
	endpoint: ENDPOINT,
	credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
	forcePathStyle: true,
	requestChecksumCalculation: "WHEN_REQUIRED",
	responseChecksumValidation: "WHEN_REQUIRED",
});

// ── Types ─────────────────────────────────────────────────────────────────
type UploadPlanItem = {
	filePath: string;
	key: string;
	cacheControl: string;
};

type UploadResult = {
	key: string;
	size: number;
	skipped: boolean;
	dryRun?: boolean;
};

type UploadFailure = {
	error: unknown;
	item: UploadPlanItem;
};

type WorkerResult = UploadResult | UploadFailure | undefined;

function isFailure(r: WorkerResult): r is UploadFailure {
	return !!r && typeof r === "object" && "error" in r;
}

// ── Filesystem helpers ─────────────────────────────────────────────────────
async function* walk(dir: string): AsyncGenerator<string> {
	let entries: Dirent<string>[];
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
		throw err;
	}
	for (const entry of entries) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			yield* walk(full);
		} else if (entry.isFile()) {
			yield full;
		}
	}
}

function toPosixKey(...parts: string[]): string {
	return parts
		.filter(Boolean)
		.join("/")
		.split(sep)
		.join(posix.sep)
		.replace(/^\/+/, "");
}

// ── Object existence check (so we can skip already-uploaded immutable files) ─
async function objectExists(key: string): Promise<boolean> {
	try {
		await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
		return true;
	} catch (err) {
		const e = err as S3ServiceException;
		if (e?.$metadata?.httpStatusCode === 404 || e?.name === "NotFound") {
			return false;
		}
		throw err;
	}
}

async function uploadFile(item: UploadPlanItem): Promise<UploadResult> {
	const { filePath, key, cacheControl } = item;
	const { size } = await stat(filePath);

	if (DRY_RUN) {
		console.log(`  ↑ [dry-run] ${key} (${size} bytes)`);
		return { key, size, skipped: false, dryRun: true };
	}

	// `.next/static` is content-addressed; once a key exists with the same
	// hashed name it will have the same bytes. Skip the re-upload to save
	// bandwidth on every deploy.
	if (cacheControl.includes("immutable") && (await objectExists(key))) {
		return { key, size, skipped: true };
	}

	await s3.send(
		new PutObjectCommand({
			Bucket: BUCKET,
			Key: key,
			Body: createReadStream(filePath),
			ContentLength: size,
			ContentType: mimeFor(filePath),
			CacheControl: cacheControl,
		}),
	);
	return { key, size, skipped: false };
}

// ── Limited-concurrency pool ──────────────────────────────────────────────
async function runPool<T, R>(
	items: T[],
	worker: (item: T, index: number) => Promise<R>,
	concurrency: number,
): Promise<Array<R | { error: unknown; item: T }>> {
	const results: Array<R | { error: unknown; item: T }> = new Array(
		items.length,
	);
	let cursor = 0;

	async function next(): Promise<void> {
		const i = cursor++;
		if (i >= items.length) return;
		try {
			results[i] = await worker(items[i], i);
		} catch (err) {
			results[i] = { error: err, item: items[i] };
		}
		return next();
	}

	const runners = Array.from(
		{ length: Math.min(concurrency, items.length) },
		() => next(),
	);
	await Promise.all(runners);
	return results;
}

// ── Build the upload plan ─────────────────────────────────────────────────
async function collectPlan(): Promise<UploadPlanItem[]> {
	const plan: UploadPlanItem[] = [];

	for await (const filePath of walk(NEXT_STATIC_DIR)) {
		const rel = relative(NEXT_STATIC_DIR, filePath);
		plan.push({
			filePath,
			key: toPosixKey("_next/static", rel),
			cacheControl: IMMUTABLE_CACHE_CONTROL,
		});
	}

	for await (const filePath of walk(PUBLIC_DIR)) {
		const rel = relative(PUBLIC_DIR, filePath);
		plan.push({
			filePath,
			key: toPosixKey(rel),
			cacheControl: PUBLIC_CACHE_CONTROL,
		});
	}

	return plan;
}

// ── Pruning ───────────────────────────────────────────────────────────────
// "Two-deploy delay": after uploading build N, delete `_next/static/` objects
// referenced by neither build N nor N-1. Unlike an R2 age-based lifecycle rule,
// this is correct regardless of deploy cadence and keeps N-1's chunks around
// for in-flight users still lazy-loading them.

type PreviousManifest = {
	keys: string[];
};

/**
 * Fetch the previous deploy's manifest. Returns `null` when the object is
 * missing or unparseable, which degrades gracefully into a no-op prune.
 */
async function loadPreviousManifest(): Promise<PreviousManifest | null> {
	let body: string;
	try {
		const res = await s3.send(
			new GetObjectCommand({ Bucket: BUCKET, Key: PREVIOUS_MANIFEST_KEY }),
		);
		body = (await res.Body?.transformToString()) ?? "";
	} catch (err) {
		const e = err as S3ServiceException;
		if (
			e?.$metadata?.httpStatusCode === 404 ||
			e?.name === "NoSuchKey" ||
			e?.name === "NotFound"
		) {
			return null;
		}
		throw err;
	}

	try {
		const parsed = JSON.parse(body) as Partial<PreviousManifest>;
		if (!Array.isArray(parsed.keys)) return null;
		// Keep only string entries before they drive DeleteObjects.
		return {
			keys: parsed.keys.filter((k): k is string => typeof k === "string"),
		};
	} catch (err) {
		console.warn(
			`⚠ Previous manifest at ${PREVIOUS_MANIFEST_KEY} was unparseable; ` +
				`skipping prune for this deploy. (${(err as Error).message})`,
		);
		return null;
	}
}

/** List every object under PRUNE_PREFIX, paginating past the 1000-key limit. */
async function listAllPrunablePrefixKeys(): Promise<string[]> {
	const keys: string[] = [];
	let continuationToken: string | undefined;
	do {
		const res = await s3.send(
			new ListObjectsV2Command({
				Bucket: BUCKET,
				Prefix: PRUNE_PREFIX,
				ContinuationToken: continuationToken,
			}),
		);
		for (const obj of res.Contents ?? []) {
			if (obj.Key) keys.push(obj.Key);
		}
		continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
	} while (continuationToken);
	return keys;
}

/** Delete `keys` in DELETE_BATCH_SIZE batches, returning success/error counts. */
async function deleteKeys(
	keys: string[],
): Promise<{ deleted: number; errors: number }> {
	let deleted = 0;
	let errors = 0;
	for (let i = 0; i < keys.length; i += DELETE_BATCH_SIZE) {
		const batch = keys.slice(i, i + DELETE_BATCH_SIZE);
		const res = await s3.send(
			new DeleteObjectsCommand({
				Bucket: BUCKET,
				Delete: {
					Objects: batch.map((Key) => ({ Key })),
					// Quiet: return only failures, cutting response size on large batches.
					Quiet: true,
				},
			}),
		);
		const batchErrors = res.Errors ?? [];
		for (const e of batchErrors) {
			console.error(`  ✗ delete ${e.Key}: ${e.Code} ${e.Message ?? ""}`);
		}
		errors += batchErrors.length;
		deleted += batch.length - batchErrors.length;
	}
	return { deleted, errors };
}

/**
 * Compute and execute the prune set: bucket `_next/static/` contents minus
 * `currentKeys` minus the previous deploy's keys are safe to remove.
 */
async function pruneStaleAssets(currentKeys: Set<string>): Promise<{
	scanned: number;
	deleted: number;
	errors: number;
	skipped: boolean;
}> {
	const previous = await loadPreviousManifest();
	if (!previous) {
		console.log(
			"  ↷ No previous manifest found — skipping prune pass (first run after this feature lands, or manifest unreadable).",
		);
		return { scanned: 0, deleted: 0, errors: 0, skipped: true };
	}

	const bucketKeys = await listAllPrunablePrefixKeys();
	const previousSet = new Set(previous.keys);

	const toDelete: string[] = [];
	for (const key of bucketKeys) {
		if (currentKeys.has(key)) continue; // still referenced by this build
		if (previousSet.has(key)) continue; // grace: still referenced by N-1
		toDelete.push(key);
	}

	if (toDelete.length === 0) {
		return {
			scanned: bucketKeys.length,
			deleted: 0,
			errors: 0,
			skipped: false,
		};
	}

	console.log(
		`  ✂ Pruning ${toDelete.length} stale object(s) under ${PRUNE_PREFIX} ` +
			`(scanned ${bucketKeys.length}, kept ${bucketKeys.length - toDelete.length})`,
	);
	const { deleted, errors } = await deleteKeys(toDelete);
	return { scanned: bucketKeys.length, deleted, errors, skipped: false };
}

/** Persist the current build's key set as the next deploy's "previous manifest". */
async function writePreviousManifest(currentKeys: Set<string>): Promise<void> {
	const body = `${JSON.stringify(
		{ keys: [...currentKeys].sort(), generatedAt: new Date().toISOString() },
		null,
		2,
	)}\n`;
	await s3.send(
		new PutObjectCommand({
			Bucket: BUCKET,
			Key: PREVIOUS_MANIFEST_KEY,
			Body: body,
			ContentType: "application/json; charset=utf-8",
			// Always re-fetched on the next deploy; no caching wanted.
			CacheControl: "no-store",
		}),
	);
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
	const startedAt = Date.now();
	console.log(
		`▶ Uploading static assets to R2 bucket "${BUCKET}" via ${ENDPOINT}` +
			(DRY_RUN ? " (dry-run)" : ""),
	);

	const plan = await collectPlan();
	if (plan.length === 0) {
		console.warn(
			"⚠ No assets found. Did you run `next build` first? " +
				`(looked in ${NEXT_STATIC_DIR} and ${PUBLIC_DIR})`,
		);
		// Still write an empty manifest so Turbo's output cache is satisfied.
		await mkdir(join(REPO_ROOT, ".next"), { recursive: true });
		await writeFile(
			MANIFEST_PATH,
			`${JSON.stringify(
				{ bucket: BUCKET, uploaded: [], skipped: [], dryRun: DRY_RUN },
				null,
				2,
			)}\n`,
		);
		return;
	}

	const results = await runPool(plan, uploadFile, CONCURRENCY);

	const uploaded: string[] = [];
	const skipped: string[] = [];
	const failed: UploadFailure[] = [];
	for (const r of results) {
		if (!r) continue;
		if (isFailure(r)) failed.push(r);
		else if (r.skipped) skipped.push(r.key);
		else uploaded.push(r.key);
	}

	for (const f of failed) {
		const msg = f.error instanceof Error ? f.error.message : String(f.error);
		console.error(`  ✗ ${f.item?.key ?? "<unknown>"}: ${msg}`);
	}

	const manifest = {
		bucket: BUCKET,
		endpoint: ENDPOINT,
		assetPrefix: process.env.NEXT_PUBLIC_ASSET_PREFIX ?? null,
		dryRun: DRY_RUN,
		uploaded,
		skipped,
		generatedAt: new Date().toISOString(),
	};
	await mkdir(join(REPO_ROOT, ".next"), { recursive: true });
	await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

	const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
	console.log(
		`✓ Asset sync complete in ${elapsed}s — ${uploaded.length} uploaded, ` +
			`${skipped.length} skipped, ${failed.length} failed`,
	);
	console.log(`  manifest: ${relative(REPO_ROOT, MANIFEST_PATH)}`);

	// Prune stale assets, then persist this build's manifest. Skipped on DRY_RUN
	// or any upload failure (pruning could 404 an asset whose new copy didn't
	// land). currentKeys covers uploaded + skipped, as both belong to this build.
	if (!DRY_RUN && failed.length === 0) {
		const currentKeys = new Set<string>();
		for (const item of plan) {
			if (item.key.startsWith(PRUNE_PREFIX)) currentKeys.add(item.key);
		}

		try {
			const prune = await pruneStaleAssets(currentKeys);
			if (!prune.skipped) {
				console.log(
					`  ✓ Prune complete — scanned ${prune.scanned}, ` +
						`deleted ${prune.deleted}, errors ${prune.errors}`,
				);
			}
			// Update the previous-manifest pointer after the prune so the next
			// deploy has a correct N-1 reference even after a partial prune.
			await writePreviousManifest(currentKeys);
		} catch (err) {
			// Pruning is best-effort — never fail the deploy over it.
			console.error(
				"⚠ Prune / previous-manifest write failed (deploy will continue):",
				err,
			);
		}
	} else if (DRY_RUN) {
		console.log("  ↷ Skipping prune pass (dry run)");
	} else {
		console.log(
			`  ↷ Skipping prune pass (${failed.length} upload failure(s) — ` +
				"would risk removing assets whose new copy didn't land)",
		);
	}

	if (failed.length > 0) process.exit(1);
}

main().catch((err: unknown) => {
	console.error("✗ Asset upload failed:", err);
	process.exit(1);
});
