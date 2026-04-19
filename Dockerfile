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
# Asset prefix used by Next.js for /_next/static/* + /_next/image. Replaced
# at container startup so the same image can target different CDNs/buckets.
# Defaults to "" so Next falls back to serving assets from the same origin.
ENV NEXT_PUBLIC_ASSET_PREFIX="__NEXT_PUBLIC_ASSET_PREFIX__"

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
RUN for v in TURBO_TEAM TURBO_TEAMID TURBO_TOKEN TURBO_API TURBO_REMOTE_CACHE_SIGNATURE_KEY; do \
      if eval "[ \"\${$v}\" = \"\\\${${v}}\" ]"; then \
        echo "  unset literal placeholder for \$v"; \
        unset $v; \
        export $v=""; \
      fi; \
    done && \
    pnpm run build

# Strip TURBO_TOKEN from the env so it doesn't leak into the runner stage's
# inherited env or any subsequent layers. (The runner stage starts FROM a
# fresh base image anyway, but be defensive.)
ENV TURBO_TOKEN=""


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
