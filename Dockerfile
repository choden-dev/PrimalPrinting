# ── Stage 1: Install dependencies ─────────────────────────────────────────
FROM node:22-slim AS deps

WORKDIR /app

# Enable pnpm via corepack (matches packageManager in package.json)
RUN corepack enable pnpm

# Copy only the files pnpm needs to resolve packages
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* .npmrc* ./
# Canvas shim referenced by pnpm.overrides — must exist during install
COPY shims/ ./shims/

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile


# ── Stage 2: Build the application ───────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

RUN corepack enable pnpm

# Copy deps from stage 1
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Next.js collects anonymous telemetry — disable in CI/Docker builds
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Placeholders for NEXT_PUBLIC_* vars — Next.js inlines these into the client
# bundle at build time. The entrypoint script (docker-entrypoint.sh) replaces
# them with real values at container startup, keeping the image env-agnostic.
ENV NEXT_PUBLIC_BASE_URL="__NEXT_PUBLIC_BASE_URL__"
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="__NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY__"
ENV NEXT_PUBLIC_MINIMUM_ITEMS_FOR_DISCOUNT="__NEXT_PUBLIC_MINIMUM_ITEMS_FOR_DISCOUNT__"
ENV NEXT_PUBLIC_DISCOUNT_PERCENT="__NEXT_PUBLIC_DISCOUNT_PERCENT__"
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
#   - TURBO_TEAM     (your Vercel team slug)  — or TURBO_TEAMID for the team_… ID
#   - TURBO_TOKEN    (mark as Secret)
#   - TURBO_API      (optional, only for self-hosted caches)
#
# Turbo silently falls back to local cache when TURBO_TOKEN is absent.
ARG TURBO_TEAM=""
ARG TURBO_TEAMID=""
ARG TURBO_TOKEN=""
ARG TURBO_API=""
ARG TURBO_REMOTE_CACHE_SIGNATURE_KEY=""
ENV TURBO_TEAM=$TURBO_TEAM \
    TURBO_TEAMID=$TURBO_TEAMID \
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
RUN for v in TURBO_TEAM TURBO_TEAMID TURBO_TOKEN TURBO_API TURBO_REMOTE_CACHE_SIGNATURE_KEY \
             NEXT_PUBLIC_ASSET_PREFIX R2_ASSETS_BUCKET R2_S3_ENDPOINT R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY; do \
      if eval "[ \"\${$v}\" = \"\\\${${v}}\" ]"; then \
        echo "  unset literal placeholder for \$v"; \
        unset $v; \
        export $v=""; \
      fi; \
    done && \
    if [ -n "$R2_ASSETS_BUCKET" ] && [ -n "$R2_ACCESS_KEY_ID" ] && [ -n "$R2_SECRET_ACCESS_KEY" ] && [ -n "$R2_S3_ENDPOINT" ]; then \
      echo "→ Building with headless asset upload (R2_ASSETS_BUCKET=$R2_ASSETS_BUCKET)"; \
      pnpm run build:headless; \
    else \
      echo "→ R2 asset upload credentials not provided — running plain Next build (assetPrefix will be unused)"; \
      pnpm run build; \
    fi

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
