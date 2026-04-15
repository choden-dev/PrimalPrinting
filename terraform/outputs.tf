output "r2_bucket_name" {
  description = "Name of the created R2 media bucket"
  value       = cloudflare_r2_bucket.media.name
}

output "r2_s3_endpoint" {
  description = "S3-compatible endpoint for all R2 buckets (use as S3_ENDPOINT in the app)"
  value       = "https://${var.cloudflare_account_id}.r2.cloudflarestorage.com"
}

output "r2_staging_bucket_name" {
  description = "Name of the staging R2 bucket for temporary order files"
  value       = cloudflare_r2_bucket.order_staging.name
}

output "r2_permanent_bucket_name" {
  description = "Name of the permanent R2 bucket for confirmed order files"
  value       = cloudflare_r2_bucket.order_permanent.name
}

output "r2_staging_expiry_days" {
  description = "Auto-expiry period (days) for objects in the staging bucket"
  value       = var.r2_staging_expiry_days
}
