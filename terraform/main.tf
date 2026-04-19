terraform {
  required_version = ">= 1.5"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# ---------------------------------------------------------------------------
# Cloudflare R2 bucket for Payload CMS media uploads
# ---------------------------------------------------------------------------
resource "cloudflare_r2_bucket" "media" {
  account_id = var.cloudflare_account_id
  name       = var.r2_bucket_name
  location   = var.r2_location
}

# ---------------------------------------------------------------------------
# Public access – optional custom domain handled outside Terraform.
# To serve media publicly you can either:
#   1. Enable the R2.dev subdomain in the Cloudflare dashboard, or
#   2. Connect a custom domain via a Cloudflare Worker / public bucket setting.
# The `R2_PUBLIC_URL` env var in the app should point to whichever URL you choose.
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# R2 bucket for staging order files (PDFs + bank transfer proofs).
# Files here are temporary – a lifecycle rule auto-deletes after 7 days.
# ---------------------------------------------------------------------------
resource "cloudflare_r2_bucket" "order_staging" {
  account_id = var.cloudflare_account_id
  name       = var.r2_staging_bucket_name
  location   = var.r2_location
}

# Lifecycle rule: auto-expire objects in the staging bucket after 7 days.
resource "cloudflare_r2_bucket_lifecycle" "staging_expiry" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.order_staging.name

  rules = [{
    id      = "expire-staging-objects"
    enabled = true

    conditions = {
      prefix = ""  # apply to all objects in the bucket
    }

    delete_objects_transition = {
      condition = {
        type    = "Age"
        max_age = var.r2_staging_expiry_days * 86400  # convert days to seconds
      }
    }
  }]
}

# ---------------------------------------------------------------------------
# R2 bucket for permanent order files (transferred here once payment is confirmed).
# No lifecycle rule – files are retained indefinitely.
# ---------------------------------------------------------------------------
resource "cloudflare_r2_bucket" "order_permanent" {
  account_id = var.cloudflare_account_id
  name       = var.r2_permanent_bucket_name
  location   = var.r2_location
}

# ---------------------------------------------------------------------------
# R2 bucket for headless static-asset hosting.
#
# `scripts/upload-assets.mts` mirrors `.next/static/**` and `public/**` into
# this bucket after each Next.js build. The Next app then references those
# objects via `assetPrefix` (NEXT_PUBLIC_ASSET_PREFIX), so the standalone
# server doesn't have to serve any static traffic.
# ---------------------------------------------------------------------------
resource "cloudflare_r2_bucket" "assets" {
  account_id = var.cloudflare_account_id
  name       = var.r2_assets_bucket_name
  location   = var.r2_location
}

# Enable the R2.dev managed subdomain so the bucket is reachable publicly
# even when no custom domain is configured. For production you should attach
# a custom domain (see r2_assets_custom_domain below) and front it with
# Cloudflare caching rules.
resource "cloudflare_r2_managed_domain" "assets" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.assets.name
  enabled     = true
}

# Optional custom domain — only created when the caller supplies a hostname
# *and* the zone ID that owns it.
#
# Two-part wiring (both managed by Terraform so state stays in sync):
#   1. cloudflare_r2_custom_domain.assets — registers the hostname on the
#      R2 bucket so Cloudflare will serve objects from it.
#   2. cloudflare_dns_record.assets — proxied CNAME pointing the hostname
#      at the R2 endpoint. Cloudflare's R2 attachment auto-creates this
#      record server-side too, but managing it here keeps drift detectable
#      via `terraform plan` and lets us tune TTL / comments.
locals {
  r2_assets_enable_custom_domain = (
    var.r2_assets_custom_domain != "" && var.r2_assets_zone_id != ""
  )

  # The hostname (without zone) used as the DNS record name. Cloudflare's
  # API expects either the bare label (e.g. "assets") or the full FQDN.
  # We pass the FQDN since users supply the full hostname.
  r2_assets_dns_record_name = var.r2_assets_custom_domain
}

resource "cloudflare_dns_record" "assets" {
  count = local.r2_assets_enable_custom_domain ? 1 : 0

  zone_id = var.r2_assets_zone_id
  name    = local.r2_assets_dns_record_name
  type    = "CNAME"
  # Cloudflare's R2 endpoint for the bucket. The proxy (orange cloud) handles
  # TLS termination + caching; the actual bucket is reached via this hostname.
  content = "${cloudflare_r2_bucket.assets.name}.${var.cloudflare_account_id}.r2.cloudflarestorage.com"
  ttl     = 1 # 1 = "automatic" (required when proxied)
  proxied = true
  comment = "Managed by Terraform — Next.js asset CDN (R2 bucket ${cloudflare_r2_bucket.assets.name})"
}

resource "cloudflare_r2_custom_domain" "assets" {
  count = local.r2_assets_enable_custom_domain ? 1 : 0

  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.assets.name
  domain      = var.r2_assets_custom_domain
  zone_id     = var.r2_assets_zone_id
  enabled     = true
  min_tls     = "1.2"

  # Make sure the DNS record exists before we ask R2 to attach to it.
  depends_on = [cloudflare_dns_record.assets]
}
