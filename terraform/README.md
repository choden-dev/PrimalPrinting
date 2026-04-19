# Terraform – Cloudflare R2 Infrastructure

This directory contains Terraform configuration to provision a **Cloudflare R2** bucket used by Payload CMS for media uploads.

## Prerequisites

| Tool       | Version  | Install                                      |
| ---------- | -------- | -------------------------------------------- |
| Terraform  | ≥ 1.5    | https://developer.hashicorp.com/terraform/install |
| Cloudflare account | —  | https://dash.cloudflare.com/sign-up         |

You will also need a **Cloudflare API token** with the following permissions:

- **Account → R2 → Edit** — create and manage buckets
- **Zone → Zone → Read** — *required only when `r2_assets_custom_domain` is set*
- **Zone → DNS → Edit** — *required only when `r2_assets_custom_domain` is set* (so Terraform can create the proxied CNAME pointing at the R2 endpoint)

You can create one at **Cloudflare Dashboard → My Profile → API Tokens → Create Token**. Scope the zone permissions to the specific zone(s) hosting your asset domain(s).

## Quick Start

```bash
cd terraform

# 1. Copy the example variables file
cp terraform.tfvars.example terraform.tfvars

# 2. Fill in your values
#    - cloudflare_api_token  : your API token
#    - cloudflare_account_id : found at the top-right of the Cloudflare dashboard
#    - r2_bucket_name        : defaults to "primalprinting-media"
#    - r2_location           : defaults to "APAC" (options: ENAM, WNAM, APAC, WEUR, EEUR)

# 3. Initialise Terraform
terraform init

# 4. Preview the changes
terraform plan

# 5. Apply
terraform apply
```

## Variables

| Name                       | Required | Default                  | Description                                                                                |
| -------------------------- | -------- | ------------------------ | ------------------------------------------------------------------------------------------ |
| `cloudflare_api_token`     | ✅        | —                        | Cloudflare API token with R2 permissions                                                   |
| `cloudflare_account_id`    | ✅        | —                        | Your Cloudflare account ID                                                                 |
| `r2_bucket_name`           | ❌        | `primalprinting-media`   | Payload CMS media bucket                                                                   |
| `r2_staging_bucket_name`   | ❌        | `primalprinting-staging` | Temporary order files (auto-expired)                                                       |
| `r2_permanent_bucket_name` | ❌        | `primalprinting-orders`  | Permanent order files                                                                      |
| `r2_staging_expiry_days`   | ❌        | `7`                      | Auto-expiry window for the staging bucket                                                  |
| `r2_assets_bucket_name`    | ❌        | `primalprinting-assets`  | Static-asset bucket used for headless `assetPrefix` serving                                |
| `r2_assets_custom_domain`  | ❌        | `""`                     | Custom domain for the assets bucket (e.g. `assets.primalprinting.com`). Empty = R2.dev URL |
| `r2_assets_zone_id`        | ❌        | `""`                     | Zone ID owning `r2_assets_custom_domain`. Required if a custom domain is set               |
| `r2_assets_max_age_seconds`| ❌        | `31536000`               | Cache-Control max-age advertised by the upload script for fingerprinted assets             |
| `r2_location`              | ❌        | `APAC`                   | Bucket location hint                                                                       |

## Outputs

| Name                       | Description                                                                |
| -------------------------- | -------------------------------------------------------------------------- |
| `r2_bucket_name`           | Name of the Payload media bucket                                           |
| `r2_s3_endpoint`           | S3-compatible endpoint URL — use as `R2_S3_ENDPOINT` in the app            |
| `r2_staging_bucket_name`   | Staging order-file bucket name                                             |
| `r2_permanent_bucket_name` | Permanent order-file bucket name                                           |
| `r2_staging_expiry_days`   | Auto-expiry window for the staging bucket                                  |
| `r2_assets_bucket_name`    | Static-asset bucket — pass to the upload script as `R2_ASSETS_BUCKET`      |
| `r2_assets_managed_domain` | R2.dev URL for the assets bucket                                           |
| `r2_assets_public_url`     | Recommended `NEXT_PUBLIC_ASSET_PREFIX` value (custom domain when provided) |

## Headless Asset Hosting

For a fully headless setup the static assets emitted by `next build` are
mirrored to the `assets` R2 bucket and Next.js is told to load them via
[`assetPrefix`](https://nextjs.org/docs/app/api-reference/next-config-js/assetPrefix).
That removes asset-serving load from the standalone server entirely.

After `terraform apply`:

```bash
# 1. Read the bucket name + public URL Terraform created
export R2_ASSETS_BUCKET="$(terraform output -raw r2_assets_bucket_name)"
export NEXT_PUBLIC_ASSET_PREFIX="$(terraform output -raw r2_assets_public_url)"

# 2. R2 S3 credentials (the same token used by the app for media is fine)
export R2_S3_ENDPOINT="$(terraform output -raw r2_s3_endpoint)"
export R2_ACCESS_KEY_ID=...
export R2_SECRET_ACCESS_KEY=...

# 3. Build + upload (Turbo orchestrates both tasks and caches them)
pnpm run build:headless
```

`scripts/upload-assets.mts` mirrors:
- `.next/static/**` → `_next/static/**` with `Cache-Control: public, max-age=31536000, immutable`
- `public/**`       → `**`              with `Cache-Control: public, max-age=3600`

It writes `.next/asset-upload.manifest.json` so Turbo can cache the task
output and skip re-uploads when nothing has changed. Already-uploaded
fingerprinted files in `_next/static/` are HEADed first and skipped.

## Enabling Public Access

After the bucket is created, you need to make it publicly readable so uploaded images can be served to visitors. There are two options:

### Option A – R2.dev subdomain (quickest)

1. Go to **Cloudflare Dashboard → R2 → your bucket → Settings**
2. Under **Public access**, enable the **R2.dev subdomain**
3. Copy the generated URL (e.g. `https://pub-abc123.r2.dev`)
4. Set `R2_PUBLIC_URL` to that URL in your app environment

### Option B – Custom domain (recommended for production)

1. Go to **Cloudflare Dashboard → R2 → your bucket → Settings**
2. Under **Public access → Custom Domains**, add your domain (e.g. `media.primalprinting.com`)
3. Cloudflare will automatically configure DNS and TLS
4. Set `R2_PUBLIC_URL` to `https://media.primalprinting.com`

## State Management

By default Terraform stores state locally in `terraform.tfstate`. This file is git-ignored. For team usage, consider using a [remote backend](https://developer.hashicorp.com/terraform/language/backend) such as Terraform Cloud or an S3-compatible backend.

## Destroying Resources

```bash
terraform destroy
```

> ⚠️ This will delete the R2 bucket and all objects inside it. Make sure you have backups.
