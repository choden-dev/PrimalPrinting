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

RUN pnpm build


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
