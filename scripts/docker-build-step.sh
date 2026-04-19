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
#   3. Picking `build:headless` (which runs `next build` + the R2
#      asset-upload script) when all R2 credentials are present, otherwise
#      falling back to a plain `next build`.
#
# Kept as a standalone POSIX shell script (sh, not bash) so it runs cleanly
# inside node:22-slim without requiring extra packages.

set -eu

VARS="TURBO_TEAM TURBO_TEAMID TURBO_TOKEN TURBO_API TURBO_REMOTE_CACHE_SIGNATURE_KEY \
      NEXT_PUBLIC_ASSET_PREFIX R2_ASSETS_BUCKET R2_S3_ENDPOINT R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY"

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
echo "  • TURBO_TEAM=${TURBO_TEAM:-<unset>}"
echo "  • TURBO_TOKEN=$(mask "${TURBO_TOKEN:-}")"
echo "  • NEXT_PUBLIC_ASSET_PREFIX=${NEXT_PUBLIC_ASSET_PREFIX:-<unset>}"
echo "  • R2_ASSETS_BUCKET=${R2_ASSETS_BUCKET:-<unset>}"
echo "  • R2_S3_ENDPOINT=${R2_S3_ENDPOINT:-<unset>}"
echo "  • R2_ACCESS_KEY_ID=$(mask "${R2_ACCESS_KEY_ID:-}")"
echo "  • R2_SECRET_ACCESS_KEY=$(mask "${R2_SECRET_ACCESS_KEY:-}")"

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
