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
      prefix = "" # apply to all objects in the bucket
    }

    delete_objects_transition = {
      condition = {
        type    = "Age"
        max_age = var.r2_staging_expiry_days * 86400 # convert days to seconds
      }
    }
  }]
}

# ---------------------------------------------------------------------------
# CORS policy for the staging bucket.
#
# Customers PUT their PDF uploads directly to this bucket from the browser
# using short-lived presigned URLs issued by /api/shop/staging-urls. Without
# CORS, the browser would block the cross-origin PUT and the upload would
# fail with a generic network error.
#
# We only need PUT (browser → R2 upload) — the server-side SDK calls
# (HEAD / GET / DELETE on staging objects) are made server-to-server and
# don't go through the browser CORS check.
# ---------------------------------------------------------------------------
resource "cloudflare_r2_bucket_cors" "staging" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.order_staging.name

  rules = [{
    id = "allow-app-presigned-uploads"

    allowed = {
      methods = ["PUT"]
      origins = concat(
        ["https://primalprinting.co.nz", "https://www.primalprinting.co.nz"],
        var.r2_staging_extra_cors_origins,
      )
      # Allow the headers the browser sets on a presigned PUT.
      # `Content-Type` is required because the presigned URL is signed against
      # the content type the server picked — the browser must echo it back.
      headers = ["Content-Type", "Content-Length", "x-amz-content-sha256"]
    }

    # Expose ETag so the client can verify upload integrity if needed.
    expose_headers = ["ETag"]

    # 1h preflight cache. Lower than the asset bucket because uploads are
    # rarer and we'd like CORS changes to roll out reasonably fast.
    max_age_seconds = 3600
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

# ---------------------------------------------------------------------------
# CORS policy for the headless asset bucket.
#
# The Next.js app is served from https://primalprinting.co.nz but loads its
# static bundle (JS, CSS, fonts, the pdf.js worker, …) from
# https://assets.primalprinting.co.nz via NEXT_PUBLIC_ASSET_PREFIX. Browsers
# treat that as cross-origin, so any request that triggers CORS — most
# notably the dynamic `import()` of the pdf.js worker module — is rejected
# unless R2 returns Access-Control-Allow-Origin.
#
# The allow-list is intentionally narrow: only the production hostname (and
# its www. subdomain) plus the Cloudflare Workers preview origins so we can
# also smoke-test from a *.workers.dev preview if needed. If you spin up
# additional environments (staging, PR previews, …) add their origins here.
# ---------------------------------------------------------------------------
resource "cloudflare_r2_bucket_cors" "assets" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.assets.name

  rules = [{
    id = "allow-app-origins"

    allowed = {
      # GET covers normal asset fetches; HEAD covers conditional requests
      # (If-None-Match, etc.) that browsers issue on revalidation.
      methods = ["GET", "HEAD"]
      origins = concat(
        ["https://primalprinting.co.nz", "https://www.primalprinting.co.nz"],
        var.r2_assets_extra_cors_origins,
      )
      # Allow the standard fetch/Range headers so cached pdf workers,
      # video <source> Range requests, etc. all succeed.
      headers = ["Range", "If-None-Match", "If-Modified-Since"]
    }

    # Expose ETag so the browser cache can do conditional revalidation, and
    # Content-Length / Content-Range so Range-aware consumers (audio/video,
    # pdf.js streamed loads) can compute progress.
    expose_headers = ["ETag", "Content-Length", "Content-Range"]

    # 24h preflight cache — assets rarely change CORS shape and keeping this
    # high means OPTIONS preflights drop off the critical path.
    max_age_seconds = 86400
  }]
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
