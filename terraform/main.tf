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
