[![Netlify Status](https://api.netlify.com/api/v1/badges/fe4ef3b5-d940-4e97-87e6-7bffaccda58c/deploy-status)](https://app.netlify.com/sites/stalwart-otter-3d2436/deploys)

# Primal Printing - Printing for everyone.

visit: (https://primalprinting.co.nz)

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 10
- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.5 (for infrastructure)
- A MongoDB database (local or [Atlas](https://www.mongodb.com/atlas))
- A [Cloudflare](https://dash.cloudflare.com/) account (for R2 media storage)

### Installation

```bash
pnpm install
```

### Environment Variables

Copy the example and fill in your values:

```bash
cp .env.example .env.local   # if you have one, otherwise create .env.local
```

The following environment variables are required for media storage (Cloudflare R2):

| Variable               | Description                                                                 |
| ---------------------- | --------------------------------------------------------------------------- |
| `R2_BUCKET`            | R2 bucket name (default: `primalprinting-media`)                            |
| `R2_S3_ENDPOINT`       | S3-compatible endpoint: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`     |
| `R2_ACCESS_KEY_ID`     | R2 API token access key ID (from Cloudflare dashboard)                      |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret access key (from Cloudflare dashboard)                  |
| `R2_PUBLIC_URL`        | Public URL for serving media (R2.dev subdomain or custom domain)            |

See [`terraform/README.md`](./terraform/README.md) for full infrastructure setup instructions.

### Infrastructure Setup (Cloudflare R2)

Media uploads are stored in a Cloudflare R2 bucket provisioned via Terraform:

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Fill in cloudflare_api_token and cloudflare_account_id
terraform init
terraform plan
terraform apply
```

After applying, create an **R2 API Token** in the Cloudflare dashboard (R2 → Manage R2 API Tokens) and add the credentials to your environment variables.

Finally, enable public access on the bucket (either via the R2.dev subdomain or a custom domain) and set `R2_PUBLIC_URL` accordingly. See [`terraform/README.md`](./terraform/README.md) for details.

### Development

```bash
pnpm dev
```

### Production Build

```bash
pnpm build
pnpm start
```
