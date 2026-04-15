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
