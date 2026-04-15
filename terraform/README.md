# Terraform – Cloudflare R2 Infrastructure

This directory contains Terraform configuration to provision a **Cloudflare R2** bucket used by Payload CMS for media uploads.

## Prerequisites

| Tool       | Version  | Install                                      |
| ---------- | -------- | -------------------------------------------- |
| Terraform  | ≥ 1.5    | https://developer.hashicorp.com/terraform/install |
| Cloudflare account | —  | https://dash.cloudflare.com/sign-up         |

You will also need a **Cloudflare API token** with the following permissions:

- **Account → R2 → Edit** (to create and manage buckets)

You can create one at **Cloudflare Dashboard → My Profile → API Tokens → Create Token**.

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

| Name                    | Required | Default                | Description                                    |
| ----------------------- | -------- | ---------------------- | ---------------------------------------------- |
| `cloudflare_api_token`  | ✅       | —                      | Cloudflare API token with R2 permissions       |
| `cloudflare_account_id` | ✅       | —                      | Your Cloudflare account ID                     |
| `r2_bucket_name`        | ❌       | `primalprinting-media` | Name of the R2 bucket                          |
| `r2_location`           | ❌       | `APAC`                 | Bucket location hint                           |

## Outputs

| Name             | Description                                                  |
| ---------------- | ------------------------------------------------------------ |
| `r2_bucket_name` | Name of the created R2 bucket                                |
| `r2_s3_endpoint` | S3-compatible endpoint URL to use as `R2_S3_ENDPOINT` in app |

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
