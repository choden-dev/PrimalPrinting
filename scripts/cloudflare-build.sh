#!/usr/bin/env bash
# scripts/cloudflare-build.sh
#
# Cloudflare Workers Builds entrypoint.
#
# Why this script exists:
#   - The Dockerfile build step needs build-time access to R2 credentials
#     and a Turborepo Remote Cache token so it can:
#       1. Mirror static assets to R2 (`pnpm build:headless`)
#       2. Hit the remote build cache (Turbo)
#   - These are sensitive values that should NOT be committed to the repo.
#   - wrangler's `image_vars` field passes string values *literally* (no
#     `${VAR}` interpolation against the build env), and Cloudflare does
#     not auto-forward dashboard env vars as docker `--build-arg`s either.
#   - So we need a build wrapper that reads secrets from the build env
#     (Cloudflare dashboard → Build configuration → Variables and Secrets)
#     and merges them into `image_vars` at deploy time, in memory.
#
# How it works:
#   1. Validate the required secret env vars are present.
#   2. Generate a deploy-time wrangler config by overlaying the secrets
#      onto wrangler.jsonc's `image_vars`.
#   3. Hand off to `wrangler deploy` with the temporary config.
#   4. Clean up the temp file in a trap so secrets don't outlive the build.
#
# Required env vars (set as **Secrets** in Cloudflare dashboard →
# Workers → primalprinting → Settings → Build configuration →
# Variables and Secrets):
#   - R2_S3_ENDPOINT
#   - R2_ACCESS_KEY_ID
#   - R2_SECRET_ACCESS_KEY
#   - TURBO_TOKEN

set -euo pipefail

# ── Locate repo root and source config ────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SOURCE_CONFIG="${REPO_ROOT}/wrangler.jsonc"
DEPLOY_CONFIG="${REPO_ROOT}/wrangler.deploy.jsonc"

cleanup() {
	# Always wipe the rendered config — it contains plaintext secrets.
	rm -f "${DEPLOY_CONFIG}"
}
trap cleanup EXIT INT TERM

# ── Validate required secrets ─────────────────────────────────────────────
REQUIRED_SECRETS=(
	"R2_S3_ENDPOINT"
	"R2_ACCESS_KEY_ID"
	"R2_SECRET_ACCESS_KEY"
)
OPTIONAL_SECRETS=(
	# Turborepo Remote Cache. Build still succeeds without it (Turbo silently
	# falls back to local cache), but with it the docker build is much faster
	# on tree-unchanged re-deploys.
	"TURBO_TOKEN"
)

missing=()
for var in "${REQUIRED_SECRETS[@]}"; do
	if [ -z "${!var:-}" ]; then
		missing+=("${var}")
	fi
done
if [ ${#missing[@]} -gt 0 ]; then
	echo "✗ scripts/cloudflare-build.sh: missing required env vars:" >&2
	for var in "${missing[@]}"; do
		echo "    - ${var}" >&2
	done
	echo "" >&2
	echo "  Set these as Secrets in Cloudflare dashboard:" >&2
	echo "    Workers & Pages → primalprinting → Settings →" >&2
	echo "    Build configuration → Variables and Secrets" >&2
	exit 1
fi

# ── Render deploy-time wrangler config ────────────────────────────────────
# We use Node (already on PATH) to safely merge JSON without depending on
# `jq`. The merge logic:
#   - Read wrangler.jsonc (jsonc-aware: strip /* */ and // comments).
#   - Locate the first containers[] entry.
#   - Overlay the secret values onto its `image_vars` map.
#   - Re-serialize as plain JSON (wrangler accepts both .jsonc and .json).
echo "→ Rendering deploy-time wrangler config with secrets injected"

node - <<NODE_SCRIPT
const fs = require("node:fs");
const path = require("node:path");

const SOURCE = "${SOURCE_CONFIG}";
const DEST = "${DEPLOY_CONFIG}";

// Strip JSONC comments while preserving strings. Keep this minimal — we
// don't need a full jsonc parser, just enough for our own config file.
function stripJsonc(input) {
	let out = "";
	let i = 0;
	const n = input.length;
	while (i < n) {
		const c = input[i];
		const next = input[i + 1];
		// String literal — copy verbatim, respect backslash escapes.
		if (c === '"') {
			out += c;
			i++;
			while (i < n) {
				const cc = input[i];
				out += cc;
				if (cc === "\\\\" && i + 1 < n) { out += input[i + 1]; i += 2; continue; }
				if (cc === '"') { i++; break; }
				i++;
			}
			continue;
		}
		// Line comment.
		if (c === "/" && next === "/") {
			while (i < n && input[i] !== "\n") i++;
			continue;
		}
		// Block comment.
		if (c === "/" && next === "*") {
			i += 2;
			while (i < n && !(input[i] === "*" && input[i + 1] === "/")) i++;
			i += 2;
			continue;
		}
		out += c;
		i++;
	}
	// Strip trailing commas before } or ].
	return out.replace(/,(\s*[}\\]])/g, "\$1");
}

const raw = fs.readFileSync(SOURCE, "utf8");
const config = JSON.parse(stripJsonc(raw));

if (!Array.isArray(config.containers) || config.containers.length === 0) {
	console.error("✗ wrangler.jsonc has no containers[] entry to inject into");
	process.exit(1);
}
const container = config.containers[0];
container.image_vars = {
	...(container.image_vars ?? {}),
	R2_S3_ENDPOINT: process.env.R2_S3_ENDPOINT,
	R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
	R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
	...(process.env.TURBO_TOKEN ? { TURBO_TOKEN: process.env.TURBO_TOKEN } : {}),
};

fs.writeFileSync(DEST, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });

// Sanity log — confirm what got injected, mask the values.
const mask = (v) => (v ? "<set>" : "<unset>");
console.log("  • image_vars merged:");
for (const [k, v] of Object.entries(container.image_vars)) {
	const isSecret = ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "TURBO_TOKEN"].includes(k);
	console.log("    -", k, "=", isSecret ? mask(v) : v);
}
NODE_SCRIPT

# ── Hand off to wrangler ──────────────────────────────────────────────────
echo "→ Running wrangler deploy with rendered config"
exec npx wrangler deploy --config "${DEPLOY_CONFIG}"
