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

import { createReadStream } from "node:fs";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { extname, join, posix, relative, resolve, sep } from "node:path";
import process from "node:process";

import {
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
	type S3ServiceException,
} from "@aws-sdk/client-s3";

// ── Configuration ──────────────────────────────────────────────────────────
const REPO_ROOT = resolve(process.cwd());
const NEXT_STATIC_DIR = join(REPO_ROOT, ".next", "static");
const PUBLIC_DIR = join(REPO_ROOT, "public");
const MANIFEST_PATH = join(REPO_ROOT, ".next", "asset-upload.manifest.json");

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
const s3 = new S3Client({
	region: "auto",
	endpoint: ENDPOINT,
	credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
	forcePathStyle: true,
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
	let entries: Awaited<ReturnType<typeof readdir>>;
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

	if (failed.length > 0) process.exit(1);
}

main().catch((err: unknown) => {
	console.error("✗ Asset upload failed:", err);
	process.exit(1);
});
