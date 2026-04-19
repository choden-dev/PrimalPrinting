#!/bin/sh
# scripts/docker-build-step.sh
#
# Invoked by the Dockerfile builder stage. Responsible for:
#   1. Stripping any wrangler `image_vars` placeholders (literal "${VAR}"
#      strings) that weren't substituted because the corresponding
#      Cloudflare Workers Build env var was unset. Without this step Turbo
#      would treat e.g. "${TURBO_API}" as a real cache URL → broken cache.
#   2. Logging the resolved (non-secret) build-time config so deploy logs
#      are debuggable.
#   3. Bootstrapping a minimal `turbo` binary and running `turbo run
#      install:run` so node_modules is restored from the remote cache when
#      pnpm-lock.yaml hasn't changed (avoiding a multi-minute re-install
#      on every Cloudflare Workers Build, where Docker layer cache is not
#      persisted between deploys).
#   4. Picking `build:headless` (which runs `next build` + the R2
#      asset-upload script) when all R2 credentials are present, otherwise
#      falling back to a plain `next build`.
#
# Kept as a standalone POSIX shell script (sh, not bash) so it runs cleanly
# inside node:22-slim without requiring extra packages.

set -eu

VARS="TURBO_TEAMID TURBO_TOKEN TURBO_API TURBO_REMOTE_CACHE_SIGNATURE_KEY \
      NEXT_PUBLIC_ASSET_PREFIX NEXT_PUBLIC_MINIMUM_ITEMS_FOR_DISCOUNT NEXT_PUBLIC_DISCOUNT_PERCENT \
      R2_ASSETS_BUCKET R2_S3_ENDPOINT R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY"

for v in $VARS; do
	# POSIX parameter indirection — read the named var's current value.
	eval "current=\${$v:-}"
	# Single-quoted placeholder so the shell doesn't expand $v in it.
	placeholder='${'"$v"'}'
	if [ "$current" = "$placeholder" ]; then
		echo "  • stripping unsubstituted placeholder for $v"
		eval "$v="
		export "$v"
	fi
done

# Debug summary — never logs secret values, just whether they're set.
mask() {
	if [ -n "${1:-}" ]; then echo '<set>'; else echo '<unset>'; fi
}
echo "  • TURBO_TEAMID=${TURBO_TEAMID:-<unset>}"
echo "  • TURBO_TOKEN=$(mask "${TURBO_TOKEN:-}")"
echo "  • NEXT_PUBLIC_ASSET_PREFIX=${NEXT_PUBLIC_ASSET_PREFIX:-<unset>}"
echo "  • NEXT_PUBLIC_MINIMUM_ITEMS_FOR_DISCOUNT=${NEXT_PUBLIC_MINIMUM_ITEMS_FOR_DISCOUNT:-<unset>}"
echo "  • NEXT_PUBLIC_DISCOUNT_PERCENT=${NEXT_PUBLIC_DISCOUNT_PERCENT:-<unset>}"
echo "  • R2_ASSETS_BUCKET=${R2_ASSETS_BUCKET:-<unset>}"
echo "  • R2_S3_ENDPOINT=${R2_S3_ENDPOINT:-<unset>}"
echo "  • R2_ACCESS_KEY_ID=$(mask "${R2_ACCESS_KEY_ID:-}")"
echo "  • R2_SECRET_ACCESS_KEY=$(mask "${R2_SECRET_ACCESS_KEY:-}")"

# ── Cached install via Turbo remote cache ─────────────────────────────────
#
# Bootstrap turbo independently of node_modules so we can ask Turbo to fetch
# (or rebuild) node_modules itself. The bootstrap install lives in /tmp so
# it doesn't pollute /app and Turbo always sees a clean state.
#
# `turbo run install:run` will:
#   - hash the install:run inputs (pnpm-lock.yaml, package.json, etc.)
#   - on a cache HIT: replay the cached node_modules into ./node_modules and
#     skip running pnpm install entirely
#   - on a cache MISS: invoke `pnpm install --frozen-lockfile`, then upload
#     the resulting node_modules to the remote cache for future builds
#
# When TURBO_TOKEN is unset Turbo silently falls back to local cache only,
# which on a fresh Cloudflare Workers Build runner is always a miss → it
# just runs pnpm install as normal. So this is safe with or without the
# remote cache being configured.
echo "→ Bootstrapping turbo for cached install"
mkdir -p /tmp/turbo-bootstrap
cd /tmp/turbo-bootstrap
# Pin to the same major as devDependencies.turbo in package.json. corepack
# is already enabled by the Dockerfile, so `pnpm add` works without any
# prior install in /app.
pnpm add --silent --save-dev "turbo@^2.5.0" >/dev/null
TURBO_BIN="/tmp/turbo-bootstrap/node_modules/.bin/turbo"
cd /app

if [ ! -x "$TURBO_BIN" ]; then
	echo "✗ turbo bootstrap failed — falling back to direct pnpm install"
	pnpm install --frozen-lockfile
else
	echo "→ Running turbo install:run (will hit remote cache when pnpm-lock.yaml is unchanged)"
	# Use --output-logs=new-only so a cache hit shows the original install
	# log (helpful when debugging) but a cache miss only shows new output.
	"$TURBO_BIN" run install:run --output-logs=new-only
fi

if [ -n "${R2_ASSETS_BUCKET:-}" ] \
	&& [ -n "${R2_ACCESS_KEY_ID:-}" ] \
	&& [ -n "${R2_SECRET_ACCESS_KEY:-}" ] \
	&& [ -n "${R2_S3_ENDPOINT:-}" ]; then
	echo "→ Building with headless asset upload (R2_ASSETS_BUCKET=$R2_ASSETS_BUCKET)"
	exec pnpm run build:headless
else
	echo "→ R2 asset upload credentials not provided — running plain Next build (assetPrefix will be unused)"
	exec pnpm run build
fi
