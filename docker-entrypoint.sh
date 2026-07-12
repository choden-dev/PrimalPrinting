#!/bin/sh
set -e

# ── Replace NEXT_PUBLIC_* placeholders with real env var values ────────────
#
# Next.js inlines NEXT_PUBLIC_* values into the client bundle at build time.
# The Dockerfile sets unique placeholder strings (e.g. __NEXT_PUBLIC_BASE_URL__)
# so they end up in the compiled JS. This script replaces those placeholders
# with the actual runtime env var values before the server starts, keeping
# the Docker image environment-agnostic.

# Directory containing the built JS files
SEARCH_DIR="/app/.next"

# Each entry: "PLACEHOLDER|ENV_VAR_NAME|DEFAULT_VALUE"
#
# Note: NEXT_PUBLIC_MINIMUM_ITEMS_FOR_DISCOUNT, NEXT_PUBLIC_DISCOUNT_PERCENT
# and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY are intentionally NOT swapped here —
# they're baked in at build time via Docker ARGs so the values survive into
# the headless asset bundles uploaded to R2 (which this runtime sed can't
# reach). See the Dockerfile for details.
REPLACEMENTS="
__NEXT_PUBLIC_BASE_URL__|NEXT_PUBLIC_BASE_URL|
__NEXT_PUBLIC_ASSET_PREFIX__|NEXT_PUBLIC_ASSET_PREFIX|
"

# Build a single combined `sed` expression so we walk the .next tree only
# once (instead of once per placeholder). This runs on EVERY container boot
# before `node server.js`, so it sits directly on the cold-start critical
# path — the faster it finishes, the sooner the server binds port 3000 and
# the less likely Cloudflare's proxy is to time out with "Container is taking
# too long to accept the connection".
# Accumulate every placeholder→value pair into ONE combined `sed` script so
# we walk the .next tree a single time and rewrite each file at most once —
# instead of the previous one-full-tree-walk-and-rewrite *per placeholder*.
set --
for entry in $REPLACEMENTS; do
  [ -z "$entry" ] && continue

  placeholder=$(echo "$entry" | cut -d'|' -f1)
  var_name=$(echo "$entry" | cut -d'|' -f2)
  default_val=$(echo "$entry" | cut -d'|' -f3)

  # Use the env var value if set, otherwise fall back to the default
  eval "real_val=\${$var_name:-$default_val}"

  # Collect as separate `-e <script>` positional args so values containing
  # spaces or shell metacharacters are passed to sed safely (no word-split).
  set -- "$@" -e "s|${placeholder}|${real_val}|g"
done

if [ "$#" -gt 0 ]; then
  # Single tree walk, single sed invocation per file (batched via `+`), all
  # substitutions applied at once. This runs on EVERY container boot before
  # `node server.js`, so keeping it to one pass minimises cold-start latency
  # — the faster placeholders are swapped, the sooner the server binds port
  # 3000 and the less likely Cloudflare's proxy is to time out with
  # "Container is taking too long to accept the connection".
  find "$SEARCH_DIR" -type f -name '*.js' -exec sed -i "$@" {} +
fi

echo "✅ NEXT_PUBLIC_* placeholders replaced with runtime values"

# Hand off to the original command (node server.js)
exec "$@"
