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
REPLACEMENTS="
__NEXT_PUBLIC_BASE_URL__|NEXT_PUBLIC_BASE_URL|
__NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY__|NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY|
__NEXT_PUBLIC_MINIMUM_ITEMS_FOR_DISCOUNT__|NEXT_PUBLIC_MINIMUM_ITEMS_FOR_DISCOUNT|2
__NEXT_PUBLIC_DISCOUNT_PERCENT__|NEXT_PUBLIC_DISCOUNT_PERCENT|0
__NEXT_PUBLIC_ASSET_PREFIX__|NEXT_PUBLIC_ASSET_PREFIX|
"

for entry in $REPLACEMENTS; do
  [ -z "$entry" ] && continue

  placeholder=$(echo "$entry" | cut -d'|' -f1)
  var_name=$(echo "$entry" | cut -d'|' -f2)
  default_val=$(echo "$entry" | cut -d'|' -f3)

  # Use the env var value if set, otherwise fall back to the default
  eval "real_val=\${$var_name:-$default_val}"

  # Replace in all JS files under .next
  find "$SEARCH_DIR" -type f -name '*.js' -exec \
    sed -i "s|${placeholder}|${real_val}|g" {} +
done

echo "✅ NEXT_PUBLIC_* placeholders replaced with runtime values"

# Hand off to the original command (node server.js)
exec "$@"
