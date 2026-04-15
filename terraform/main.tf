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
