[![Netlify Status](https://api.netlify.com/api/v1/badges/fe4ef3b5-d940-4e97-87e6-7bffaccda58c/deploy-status)](https://app.netlify.com/sites/stalwart-otter-3d2436/deploys)

# Primal Printing - Printing for everyone.

visit: (https://primalprinting.co.nz)

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 10
- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.5 (for infrastructure)
- A MongoDB database (local or [Atlas](https://www.mongodb.com/atlas))
- A [Cloudflare](https://dash.cloudflare.com/) account (for R2 media storage)

### Installation

```bash
pnpm install
```

### Environment Variables

Copy the example and fill in your values:

```bash
cp .env.example .env.local   # if you have one, otherwise create .env.local
```

The following environment variables are required for media storage (Cloudflare R2):

| Variable               | Description                                                                 |
| ---------------------- | --------------------------------------------------------------------------- |
| `R2_BUCKET`            | R2 bucket name (default: `primalprinting-media`)                            |
| `R2_S3_ENDPOINT`       | S3-compatible endpoint: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`     |
| `R2_ACCESS_KEY_ID`     | R2 API token access key ID (from Cloudflare dashboard)                      |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret access key (from Cloudflare dashboard)                  |
| `R2_PUBLIC_URL`        | Public URL for serving media (R2.dev subdomain or custom domain)            |

See [`terraform/README.md`](./terraform/README.md) for full infrastructure setup instructions.

### Infrastructure Setup (Cloudflare R2)

Media uploads are stored in a Cloudflare R2 bucket provisioned via Terraform:

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Fill in cloudflare_api_token and cloudflare_account_id
terraform init
terraform plan
terraform apply
```

After applying, create an **R2 API Token** in the Cloudflare dashboard (R2 → Manage R2 API Tokens) and add the credentials to your environment variables.

Finally, enable public access on the bucket (either via the R2.dev subdomain or a custom domain) and set `R2_PUBLIC_URL` accordingly. See [`terraform/README.md`](./terraform/README.md) for details.

### Development

```bash
pnpm dev
```

### Production Build

```bash
pnpm build      # Turbo orchestrates `next build` with caching
pnpm start
```

### Headless Asset Hosting (R2 + assetPrefix)

For a fully "headless" deploy, the static assets emitted by `next build` are
mirrored to a dedicated Cloudflare R2 bucket and served from a CDN URL. The
standalone Next server then never has to serve static files itself.

| Variable                   | Description                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_ASSET_PREFIX` | Public origin for `_next/static/*` and `_next/image` (e.g. `https://assets.primalprinting.com`). Inlined into the client bundle at build time and re-replaced at container startup so one image can target multiple CDNs. |
| `R2_ASSETS_BUCKET`         | R2 bucket the upload script writes to. Provisioned by Terraform (`r2_assets_bucket_name`).   |

Provision the bucket with Terraform (see [`terraform/README.md`](./terraform/README.md)),
then build + upload assets in one Turbo task:

```bash
export NEXT_PUBLIC_ASSET_PREFIX="$(cd terraform && terraform output -raw r2_assets_public_url)"
export R2_ASSETS_BUCKET="$(cd terraform && terraform output -raw r2_assets_bucket_name)"
export R2_S3_ENDPOINT="$(cd terraform && terraform output -raw r2_s3_endpoint)"
export R2_ACCESS_KEY_ID=...
export R2_SECRET_ACCESS_KEY=...

pnpm run build:headless   # turbo: build:next + upload-assets:run
```

The upload script is content-aware: fingerprinted files in `.next/static/` are
HEADed first and skipped if already present, so re-deploys upload only what
actually changed.

### Build Tooling (Turbo)

Builds, lints, and asset uploads are orchestrated by [Turborepo](https://turborepo.com)
for caching + parallelism. Common tasks:

| Command                  | What it runs                                              |
| ------------------------ | --------------------------------------------------------- |
| `pnpm build`             | `turbo run build` → `next build` with cached outputs      |
| `pnpm build:headless`    | `next build` + `scripts/upload-assets.mts` (R2 sync)      |
| `pnpm upload-assets`     | Mirror `.next/static` + `public` to the R2 assets bucket  |
| `pnpm lint`              | `turbo run lint` → `biome check .`                        |
| `pnpm dev`               | `turbo run dev` → `next dev`                              |

Set `TURBO_TOKEN` / `TURBO_TEAM` in CI to enable Turborepo Remote Cache.

#### Cloudflare Workers Builds (`wrangler deploy`)

`wrangler deploy` builds the container image on Cloudflare's infrastructure.
Turbo cache vars reach the docker build via `image_vars` in `wrangler.jsonc`,
which interpolates `${VAR}` placeholders from the Cloudflare Workers Build
environment at deploy time — no secret values are committed to the repo.

In **Workers & Pages → primalprinting → Settings → Builds → Variables and
Secrets**, add:

| Name                                | Type    |
| ----------------------------------- | ------- |
| `TURBO_TEAM` (or `TURBO_TEAMID`)    | Plain   |
| `TURBO_TOKEN`                       | Secret  |
| `TURBO_API` (self-hosted only)      | Plain   |
| `TURBO_REMOTE_CACHE_SIGNATURE_KEY`  | Secret  |

The Dockerfile picks them up as `ARG`s, exports them for the `pnpm run build`
step, then clears `TURBO_TOKEN` from the env before the runner stage. Look
for `Remote caching enabled` followed by `cache hit, replaying logs` near the
top of the build log to confirm it's working.
