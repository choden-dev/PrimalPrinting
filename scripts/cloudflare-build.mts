#!/usr/bin/env tsx
// Cloudflare Workers Builds deploy entrypoint (`pnpm run deploy`). Substitutes
// `${VAR}` placeholders in wrangler.jsonc's `containers[].image_vars` from the
// build env into wrangler.deploy.jsonc, then runs `wrangler deploy`. Needed
// because wrangler passes `image_vars` literally to `docker build --build-arg`
// with no env substitution, and Cloudflare doesn't forward dashboard env vars
// into the docker build.

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

// Replace `${VAR}` references in `image_vars` with `process.env.VAR`, logging
// each substitution (without the value). Unset vars fall back to an empty
// string so the Dockerfile's placeholder-stripping passes through cleanly.
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
