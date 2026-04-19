#!/usr/bin/env tsx
/**
 * Mirror Next.js build artefacts into the R2 "assets" bucket so the standalone
 * server can run truly headless — i.e. it does not have to serve any static
 * files itself. The matching origin is configured on the Next side via
 * `assetPrefix` (NEXT_PUBLIC_ASSET_PREFIX in next.config.ts).
 *
 * What gets uploaded:
 *   - `.next/static/**`   →  `_next/static/**`   (immutable, fingerprinted)
 *   - `public/**`         →  `**`                (root of the bucket)
 *
 * Required env vars (validated below):
 *   - R2_ASSETS_BUCKET
 *   - R2_S3_ENDPOINT
 *   - R2_ACCESS_KEY_ID
 *   - R2_SECRET_ACCESS_KEY
 *
 * Optional:
 *   - ASSETS_CACHE_CONTROL   default: "public, max-age=31536000, immutable"
 *   - ASSETS_PUBLIC_CACHE_CONTROL  default: "public, max-age=3600"
 *   - ASSETS_CONCURRENCY     default: 16
 *   - ASSETS_DRY_RUN         set to "1" to skip the actual PUTs
 *
 * The script writes `.next/asset-upload.manifest.json` so Turbo can cache it
 * as the task's output.
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

// Where the previous deploy's manifest is stored *inside the bucket*. We use
// the bucket itself as the source of truth (rather than e.g. an R2 KV
// namespace) so the upload script is fully self-contained: any runner with
// R2 credentials can deploy without extra plumbing. The `_meta/` prefix
// keeps it out of the way of any user-visible asset path.
const PREVIOUS_MANIFEST_KEY = "_meta/asset-upload.manifest.previous.json";

// Only prune objects under this prefix. We deliberately leave `public/**`
// (stable filenames like favicon.ico) and the `_meta/` namespace alone.
const PRUNE_PREFIX = "_next/static/";

// `DeleteObjects` accepts up to 1000 keys per request. We size our batches
// at 500 to leave headroom for the XML overhead and to keep individual
// requests fast.
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
//
// `requestChecksumCalculation` and `responseChecksumValidation` are pinned
// to "WHEN_REQUIRED" because Cloudflare R2 does not fully support the
// `Content-Encoding: aws-chunked` + `x-amz-trailer` flexible-checksum
// framing that aws-sdk-js v3 enables by default since v3.730. Without this
// opt-out, every PutObject is rejected (streamed bodies surface as
// "non-retryable streaming request" + UnknownError; smaller bodies surface
// as 403 Access Denied), even though the credentials are correct.
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
//
// Strategy: "two-deploy delay" using the manifest from the previous deploy.
//
// After a successful upload of build N, we want to delete any object under
// `_next/static/` that is referenced by neither build N nor build N-1. Doing
// it this way (rather than an R2 lifecycle rule) is correct regardless of
// deploy cadence — a server-side age-based rule would either delete assets
// that are still in production (if the bucket's max age is shorter than the
// gap between deploys) or be effectively a no-op (if it's longer).
//
// In-flight users on build N-1 may still lazy-load chunks for ~minutes after
// deploy N goes live; keeping N-1's keys gives them comfortably more than
// enough time to either finish the current navigation or hit a fresh page
// that pulls the new chunks.

type PreviousManifest = {
	keys: string[];
};

/**
 * Fetch the previous deploy's manifest from the bucket. Returns `null` if
 * the object does not exist (first deploy of this feature) or if the body
 * is unreadable / unparseable — both cases degrade gracefully into "no
 * previous manifest known", which makes the prune pass a safe no-op.
 */
async function loadPreviousManifest(): Promise<PreviousManifest | null> {
	let body: string;
	try {
		const res = await s3.send(
			new GetObjectCommand({ Bucket: BUCKET, Key: PREVIOUS_MANIFEST_KEY }),
		);
		// `Body` is a Node Readable in node runtimes; transformToString is
		// the canonical way to drain it across SDK versions.
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
		// Defensive cast: ensure every entry is a string before we use it as
		// a Set member that drives DeleteObjects.
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

/**
 * List every object under PRUNE_PREFIX. Uses ContinuationToken pagination
 * so it works for buckets containing more than 1000 keys.
 */
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

/**
 * Delete `keys` from the bucket using `DeleteObjects` in batches of
 * DELETE_BATCH_SIZE. Returns counts so the caller can report them.
 */
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
					// Quiet mode: only failures come back, not every successful key.
					// Cuts response size for large batches and matches our reporting
					// (we only want to surface failures individually).
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
 * Compute the prune set and execute it. `currentKeys` is the set of keys
 * the just-completed deploy uploaded; the bucket's _next/static/ contents
 * minus `currentKeys` minus `previous.keys` is the set of keys that have
 * been stale for at least one full deploy cycle and are safe to remove.
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

/**
 * Persist the current build's key set as the "previous manifest" for the
 * next deploy. We write only the key list — no other metadata is needed and
 * a smaller payload makes GetObject cheaper next time.
 */
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

	// ── Prune stale assets + persist this build's manifest for the next run ─
	//
	// Guard rails:
	//   - Skip on DRY_RUN — we never want to mutate the bucket from a dry run.
	//   - Skip if any uploads failed — pruning could remove the previous
	//     build's copy of an asset whose new copy we didn't manage to upload,
	//     which would 404 in production. Better to leave the bucket fat than
	//     to break it.
	//   - The current key set covers ALL keys planned for the prune prefix
	//     (uploaded + skipped), since "skipped" just means the bytes were
	//     already in the bucket — it's still very much part of THIS build.
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
			// Always update the previous-manifest pointer on success so the
			// next deploy has the correct N-1 reference. Done after the prune
			// so a partial prune still leaves the bucket in a consistent state
			// from the next deploy's perspective.
			await writePreviousManifest(currentKeys);
		} catch (err) {
			// Pruning is best-effort — we never want a prune failure to fail
			// the deploy. Surface the error loudly but exit 0.
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
