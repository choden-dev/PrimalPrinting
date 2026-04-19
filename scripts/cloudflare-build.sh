#!/usr/bin/env bash
# scripts/cloudflare-build.sh
#
# Cloudflare Workers Builds entrypoint. Runs envsubst over wrangler.jsonc
# to substitute "${VAR}" placeholders with values from the build env (the
# Cloudflare dashboard's "Build configuration → Variables and Secrets"),
# then invokes wrangler deploy with the rendered config.
#
# Why this is needed: wrangler's `image_vars` field passes string values
# *literally* to `docker build --build-arg` — there is no `${VAR}`
# substitution against the build env — and Cloudflare doesn't auto-forward
# dashboard env vars to the docker build either. So we substitute first,
# then hand the rendered config to wrangler.
#
# Required env vars (set as Secrets in the Cloudflare dashboard):
#   - R2_S3_ENDPOINT
#   - R2_ACCESS_KEY_ID
#   - R2_SECRET_ACCESS_KEY
# Optional:
#   - TURBO_TOKEN  (Turborepo Remote Cache; build still works without it)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_CONFIG="${REPO_ROOT}/wrangler.deploy.jsonc"

# Always wipe the rendered config — it may contain plaintext secrets.
trap 'rm -f "${DEPLOY_CONFIG}"' EXIT INT TERM

# Default optional vars to empty so envsubst doesn't leave literal
# "${TURBO_TOKEN}" strings in the rendered config when they're unset.
: "${TURBO_TOKEN:=}"

# Substitute only the variable names we expect — passing a list to
# envsubst prevents accidental interpolation of any other "${...}"
# strings that might appear elsewhere in the config (e.g. comments).
echo "→ Rendering wrangler config with build-env substitutions"
envsubst '${R2_S3_ENDPOINT} ${R2_ACCESS_KEY_ID} ${R2_SECRET_ACCESS_KEY} ${TURBO_TOKEN}' \
	< "${REPO_ROOT}/wrangler.jsonc" \
	> "${DEPLOY_CONFIG}"
chmod 600 "${DEPLOY_CONFIG}"

echo "→ Running wrangler deploy with rendered config"
exec npx wrangler deploy --config "${DEPLOY_CONFIG}"
