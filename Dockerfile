# ── Stage 1: Build the application ───────────────────────────────────────
#
# We deliberately collapse install + build into a single stage so the
# `pnpm install` step can be driven by Turbo's remote cache (see
# `install:run` in turbo.json). Splitting install into its own Docker
# stage only helps when Docker layer cache is preserved between builds —
# which is NOT the case for Cloudflare Workers Builds. Turbo's remote
# cache, by contrast, IS preserved, so we get a true "skip pnpm install
# when the lockfile hasn't changed" path on every deploy.
FROM node:22-slim AS builder

WORKDIR /app

# Enable pnpm via corepack (matches packageManager in package.json)
RUN corepack enable pnpm

# Copy source code (includes package.json, pnpm-lock.yaml, shims/, turbo.json,
# and everything else needed for both the cached install and the Next build).
COPY . .

# Next.js collects anonymous telemetry — disable in CI/Docker builds
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Placeholders for NEXT_PUBLIC_* vars — Next.js inlines these into the client
# bundle at build time. The entrypoint script (docker-entrypoint.sh) replaces
# them with real values at container startup, keeping the image env-agnostic.
#
# Caveat: this runtime-swap pattern only works for bundles served by the
# standalone Next server itself. When the headless asset upload is enabled
# (NEXT_PUBLIC_ASSET_PREFIX + R2_ASSETS_BUCKET set), the client bundles are
# uploaded to R2 *during the build* — at which point the placeholders are
# frozen into the uploaded files and the entrypoint sed has nothing to patch.
# For values that must reach the headless CDN, supply them as build ARGs
# (see NEXT_PUBLIC_MINIMUM_ITEMS_FOR_DISCOUNT / NEXT_PUBLIC_DISCOUNT_PERCENT /
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY below and NEXT_PUBLIC_ASSET_PREFIX further
# down).
ENV NEXT_PUBLIC_BASE_URL="__NEXT_PUBLIC_BASE_URL__"

# Discount config + Stripe publishable key are consumed by client-side code
# (DiscountBadge, CartItem, ExtraInfo, StripePaymentForm) and therefore end up
# in the chunks uploaded to R2 — bake the real values in at build time.
# Defaults for the discount config match docker-entrypoint.sh /
# container-worker.js so an unset build env still produces a working image.
# The Stripe publishable key has no safe default (it's environment-specific
# and would silently break Stripe Elements if mis-set) so it defaults to an
# empty string — the build will succeed and the failure surfaces as a clear
# Stripe-side error instead of a confusing placeholder string.
ARG NEXT_PUBLIC_MINIMUM_ITEMS_FOR_DISCOUNT="2"
ARG NEXT_PUBLIC_DISCOUNT_PERCENT="15"
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""
ENV NEXT_PUBLIC_MINIMUM_ITEMS_FOR_DISCOUNT=$NEXT_PUBLIC_MINIMUM_ITEMS_FOR_DISCOUNT \
    NEXT_PUBLIC_DISCOUNT_PERCENT=$NEXT_PUBLIC_DISCOUNT_PERCENT \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
# Asset prefix used by Next.js for /_next/static/* + /_next/image.
#
# When supplied via wrangler `image_vars`, the real value is baked into the
# build (so `assetPrefix` resolves to the CDN URL and `pnpm upload-assets`
# logs the right value in its manifest). The docker-entrypoint.sh placeholder
# swap also re-applies the runtime value at container startup so the same
# image can target a different CDN per deploy if needed.
#
# Default to the placeholder so local builds without the var still work.
ARG NEXT_PUBLIC_ASSET_PREFIX="__NEXT_PUBLIC_ASSET_PREFIX__"
ENV NEXT_PUBLIC_ASSET_PREFIX=$NEXT_PUBLIC_ASSET_PREFIX

# ── R2 credentials for the build-time asset upload ────────────────────────
# Needed so `pnpm build:headless` (below) can run scripts/upload-assets.mts
# against the R2 assets bucket. These reuse the same R2 credentials already
# configured for runtime media access — only the bucket differs.
ARG R2_ASSETS_BUCKET=""
ARG R2_S3_ENDPOINT=""
ARG R2_ACCESS_KEY_ID=""
ARG R2_SECRET_ACCESS_KEY=""
ENV R2_ASSETS_BUCKET=$R2_ASSETS_BUCKET \
    R2_S3_ENDPOINT=$R2_S3_ENDPOINT \
    R2_ACCESS_KEY_ID=$R2_ACCESS_KEY_ID \
    R2_SECRET_ACCESS_KEY=$R2_SECRET_ACCESS_KEY

# ── Turborepo Remote Cache (optional) ─────────────────────────────────────
# Forward the team identity (slug or id), API base URL, and access token as
# plain build args. We can't use BuildKit secret mounts because `wrangler
# deploy` (which builds this image on Cloudflare Workers Builds) doesn't
# support `--secret` flags — only build args via `image_vars` in wrangler.jsonc.
#
# Threat model: the values are sourced from Cloudflare Workers Build
# environment variables (TURBO_TOKEN stored as a Secret there), interpolated
# into `image_vars` at deploy time, and only ever exist inside the Cloudflare
# build environment. The resulting image is not published — it's pulled
# directly into the Container runtime — so `docker history` exposure is
# limited to that environment.
#
# In Cloudflare Workers Builds set:
#   - TURBO_TEAM     (the Vercel team slug — already hardcoded in
#                     wrangler.jsonc image_vars, no need to set in the dashboard)
#   - TURBO_TOKEN    (mark as Secret)
#   - TURBO_API      (optional, only for self-hosted caches)
#
# Turbo silently falls back to local cache when TURBO_TOKEN is absent.
ARG TURBO_TEAM=""
ARG TURBO_TOKEN=""
ARG TURBO_API=""
ARG TURBO_REMOTE_CACHE_SIGNATURE_KEY=""
ENV TURBO_TEAM=$TURBO_TEAM \
    TURBO_TOKEN=$TURBO_TOKEN \
    TURBO_API=$TURBO_API \
    TURBO_REMOTE_CACHE_SIGNATURE_KEY=$TURBO_REMOTE_CACHE_SIGNATURE_KEY \
    # Force colour-less, scriptable Turbo output in the build log
    FORCE_COLOR=0 \
    TURBO_TELEMETRY_DISABLED=1

# Build via Turbo so the (optional) remote cache is queried before re-running
# `next build`. Look for "Remote caching enabled" + "cache hit, replaying logs"
# in the build output to confirm it's working.
#
# Defensive cleanup: wrangler's `image_vars` substitutes `${VAR}` against the
# Cloudflare Workers Build env at deploy time, but if the env var is unset
# wrangler passes through the literal "${VAR}" string instead of an empty
# value. Strip any such unsubstituted placeholders so Turbo doesn't try to
# use them as URLs / tokens.
#
# We run `build:headless` rather than `build` when R2 creds are present so
# the resulting image already has all static assets uploaded to R2. The
# upload step is gated by Turbo's input/output cache, so on a tree-unchanged
# re-deploy it's a near-instant no-op (HEAD-skips fingerprinted files).
#
# Falls back to a plain `next build` when R2 creds are missing (e.g. local
# `docker build` without secrets) so local builds still work.
# Build via a dedicated shell script under scripts/ — keeps the Dockerfile
# free of escape-soup and lets the build logic be unit-testable on its own.
COPY scripts/docker-build-step.sh /tmp/docker-build-step.sh
RUN chmod +x /tmp/docker-build-step.sh && /tmp/docker-build-step.sh && rm /tmp/docker-build-step.sh

# Strip secrets from the env so they don't leak into the runner stage's
# inherited env or any subsequent layers. (The runner stage starts FROM a
# fresh base image anyway, but be defensive.)
ENV TURBO_TOKEN="" \
    R2_SECRET_ACCESS_KEY="" \
    R2_ACCESS_KEY_ID=""


# ── Stage 3: Production runner ───────────────────────────────────────────
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Don't run as root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Copy the standalone server + static assets produced by `output: "standalone"`
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Entrypoint script that replaces NEXT_PUBLIC_* placeholders in the
# compiled client JS with real env var values at container startup.
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
