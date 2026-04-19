#!/usr/bin/env tsx
// scripts/cloudflare-build.mts
//
// Cloudflare Workers Builds entrypoint. Renders wrangler.jsonc with
// `${VAR}` placeholders inside `containers[].image_vars` substituted from
// the build env (the Cloudflare dashboard's "Build configuration →
// Variables and Secrets"), writes the result to wrangler.deploy.jsonc,
// and runs `wrangler deploy --config wrangler.deploy.jsonc`.
//
// Why this is needed: wrangler's `image_vars` field passes string values
// *literally* to `docker build --build-arg` — there is no `${VAR}`
// substitution against the build env — and Cloudflare doesn't auto-forward
// dashboard env vars into the docker build either. So we substitute first,
// then hand the rendered config to wrangler.
//
// Required env vars (set as Secrets in the Cloudflare dashboard's "Build
// configuration → Variables and Secrets"):
//   - R2_S3_ENDPOINT
//   - R2_ACCESS_KEY_ID
//   - R2_SECRET_ACCESS_KEY
// Optional:
//   - TURBO_TOKEN  (Turborepo Remote Cache; build still works without it)
//
// This script is the canonical deploy entrypoint — `pnpm run deploy`
// invokes it via tsx. Set the Cloudflare dashboard's Build command to
// `pnpm run deploy` so the substitution always runs.

import { spawn } from "node:child_process";
import { chmodSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const SOURCE_CONFIG = resolve(REPO_ROOT, "wrangler.jsonc");
const DEPLOY_CONFIG = resolve(REPO_ROOT, "wrangler.deploy.jsonc");

interface WranglerContainer {
	image_vars?: Record<string, string>;
	[key: string]: unknown;
}

interface WranglerConfig {
	containers?: WranglerContainer[];
	[key: string]: unknown;
}

// Strip // line comments and /* block */ comments from JSONC so we can parse
// it with the built-in JSON parser. Preserves comment-like sequences inside
// string literals (handles escaped quotes).
function stripJsoncComments(src: string): string {
	let out = "";
	let i = 0;
	let inString = false;
	let stringQuote = "";
	while (i < src.length) {
		const ch = src[i];
		const next = src[i + 1];
		if (inString) {
			out += ch;
			if (ch === "\\" && i + 1 < src.length) {
				out += src[i + 1];
				i += 2;
				continue;
			}
			if (ch === stringQuote) {
				inString = false;
			}
			i++;
			continue;
		}
		if (ch === '"' || ch === "'") {
			inString = true;
			stringQuote = ch;
			out += ch;
			i++;
			continue;
		}
		if (ch === "/" && next === "/") {
			// line comment — skip to end of line
			while (i < src.length && src[i] !== "\n") i++;
			continue;
		}
		if (ch === "/" && next === "*") {
			// block comment — skip to */
			i += 2;
			while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
			i += 2;
			continue;
		}
		out += ch;
		i++;
	}
	// Strip trailing commas (allowed in JSONC, not in JSON).
	return out.replace(/,(\s*[}\]])/g, "$1");
}

// Replace `${VAR}` references in `image_vars` values with `process.env.VAR`.
// Logs each substitution (without the value) so the build log is debuggable.
// Falls back to an empty string when the env var is unset, mirroring the
// previous envsubst behaviour and letting the Dockerfile's defensive
// placeholder-stripping pass through cleanly.
function substituteImageVars(config: WranglerConfig): WranglerConfig {
	const containers = config.containers ?? [];
	for (const container of containers) {
		const imageVars = container.image_vars;
		if (!imageVars || typeof imageVars !== "object") continue;
		for (const [key, value] of Object.entries(imageVars)) {
			if (typeof value !== "string") continue;
			const match = value.match(/^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/);
			if (!match) continue;
			const envName = match[1];
			const envValue = process.env[envName];
			if (envValue === undefined || envValue === "") {
				console.warn(
					`  • image_vars.${key}: env var ${envName} is unset — substituting empty string`,
				);
				imageVars[key] = "";
			} else {
				console.log(`  • image_vars.${key}: substituted from ${envName}`);
				imageVars[key] = envValue;
			}
		}
	}
	return config;
}

function cleanup(): void {
	try {
		rmSync(DEPLOY_CONFIG, { force: true });
	} catch {
		// Best-effort — file may not exist.
	}
}

async function main(): Promise<void> {
	console.log("→ Rendering wrangler config with build-env substitutions");
	const source = readFileSync(SOURCE_CONFIG, "utf8");
	const config: WranglerConfig = JSON.parse(stripJsoncComments(source));
	substituteImageVars(config);

	writeFileSync(DEPLOY_CONFIG, JSON.stringify(config, null, 2));
	// 0o600: only the build user can read this — it contains plaintext secrets.
	chmodSync(DEPLOY_CONFIG, 0o600);

	// Always wipe the rendered config — even on uncaught errors / signals.
	process.on("exit", cleanup);
	for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
		process.on(sig, () => {
			cleanup();
			process.exit(1);
		});
	}

	console.log("→ Running wrangler deploy with rendered config");
	// Forward any extra CLI args (e.g. --dry-run) so `pnpm run deploy --dry-run`
	// works as expected.
	const extraArgs = process.argv.slice(2);
	const child = spawn(
		"npx",
		["wrangler", "deploy", "--config", DEPLOY_CONFIG, ...extraArgs],
		{ stdio: "inherit", shell: false },
	);
	child.on("exit", (code, signal) => {
		cleanup();
		if (signal) {
			process.kill(process.pid, signal);
		} else {
			process.exit(code ?? 1);
		}
	});
}

main().catch((err) => {
	console.error("✖ cloudflare-build failed:", err);
	cleanup();
	process.exit(1);
});
