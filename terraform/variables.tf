variable "cloudflare_api_token" {
  description = "Cloudflare API token with R2 permissions"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "r2_bucket_name" {
  description = "Name of the R2 bucket for Payload CMS media"
  type        = string
  default     = "primalprinting-media"
}

variable "r2_location" {
  description = "R2 bucket location hint (e.g. ENAM, WNAM, APAC, WEUR, EEUR)"
  type        = string
  default     = "APAC"
}

variable "r2_staging_bucket_name" {
  description = "Name of the R2 bucket for staging order files (temporary, auto-expired)"
  type        = string
  default     = "primalprinting-staging"
}

variable "r2_permanent_bucket_name" {
  description = "Name of the R2 bucket for permanent order files (retained after payment)"
  type        = string
  default     = "primalprinting-orders"
}

variable "r2_staging_expiry_days" {
  description = "Number of days before staging bucket objects are auto-deleted"
  type        = number
  default     = 7
}

variable "r2_staging_extra_cors_origins" {
  description = "Additional origins allowed to PUT/GET directly against the staging R2 bucket via presigned URLs (e.g. staging or PR-preview hostnames). The production hostname and its www. subdomain are always included automatically. Each entry must be a full origin (scheme + host, no trailing slash)."
  type        = list(string)
  default     = []
}

# ---------------------------------------------------------------------------
# Headless static-asset hosting
# ---------------------------------------------------------------------------
variable "r2_assets_bucket_name" {
  description = "Name of the R2 bucket used to host Next.js static assets (.next/static, public/) for headless serving via assetPrefix"
  type        = string
  default     = "primalprinting-assets"
}

variable "r2_assets_custom_domain" {
  description = "Optional custom domain to attach to the R2 assets bucket (e.g. assets.primalprinting.com). Leave empty to skip and use the R2.dev subdomain instead."
  type        = string
  default     = ""
}

variable "r2_assets_zone_id" {
  description = "Cloudflare zone ID that owns r2_assets_custom_domain. Required only when r2_assets_custom_domain is set."
  type        = string
  default     = ""
}

variable "r2_assets_max_age_seconds" {
  description = "Cache-Control max-age (seconds) advertised for objects served from the assets bucket. Defaults to 1 year — Next.js fingerprints filenames so long caching is safe."
  type        = number
  default     = 31536000
}

variable "r2_assets_extra_cors_origins" {
  description = "Additional origins (e.g. https://staging.primalprinting.co.nz, https://*.workers.dev preview URLs) that should be allowed to fetch assets cross-origin from the headless R2 bucket. The production hostname and its www. subdomain are always included automatically — list only the extras here. Each entry must be a full origin (scheme + host, no trailing slash)."
  type        = list(string)
  default     = []
}
