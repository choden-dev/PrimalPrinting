output "r2_bucket_name" {
  description = "Name of the created R2 bucket"
  value       = cloudflare_r2_bucket.media.name
}

output "r2_s3_endpoint" {
  description = "S3-compatible endpoint for the R2 bucket (use as S3_ENDPOINT in the app)"
  value       = "https://${var.cloudflare_account_id}.r2.cloudflarestorage.com"
}
