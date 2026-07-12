declare namespace NodeJS {
	interface ProcessEnv {
		NODE_ENV: "development" | "production" | "test";
		GMAIL_USER: string;
		GMAIL_PASS: string;
		/** Base URL of the app, e.g. https://yourdomain.com */
		NEXT_PUBLIC_BASE_URL: string;
		/** MongoDB connection string used by Payload CMS. */
		DATABASE_URI: string;
		/** Secret used by Payload CMS for auth/encryption. Use a strong random string in production. */
		PAYLOAD_SECRET: string;
		/** Cloudflare R2 bucket for Payload CMS media uploads. */
		R2_BUCKET: string;
		/** S3-compatible R2 endpoint: https://<ACCOUNT_ID>.r2.cloudflarestorage.com */
		R2_S3_ENDPOINT: string;
		/** R2 API token access key ID (Cloudflare dashboard > R2 > Manage R2 API Tokens). */
		R2_ACCESS_KEY_ID: string;
		/** R2 API token secret access key. */
		R2_SECRET_ACCESS_KEY: string;
		/** Public URL for serving R2 media (R2.dev subdomain or custom domain). */
		R2_PUBLIC_URL: string;

		// ── Order system R2 buckets ──────────────────────────────────────
		/** R2 bucket for temporary order files (auto-expired after ~7 days). */
		R2_STAGING_BUCKET: string;
		/** R2 bucket for permanent order files (retained after payment). */
		R2_PERMANENT_BUCKET: string;

		// ── NextAuth / OAuth ─────────────────────────────────────────────
		/** Canonical site URL for NextAuth callbacks. Derived from NEXT_PUBLIC_BASE_URL — do not set separately. */
		NEXTAUTH_URL: string;
		/** NextAuth JWT/cookie encryption secret. Generate with: openssl rand -base64 32 */
		NEXTAUTH_SECRET: string;
		/** Google OAuth 2.0 client ID (Google Cloud Console > Credentials). */
		GOOGLE_CLIENT_ID: string;
		/** Google OAuth 2.0 client secret. */
		GOOGLE_CLIENT_SECRET: string;

		// ── Stripe ───────────────────────────────────────────────────────
		/** Stripe secret key for server-side API calls. */
		STRIPE_PRIVATE_KEY: string;
		/** Stripe publishable key for client-side Stripe Elements. */
		NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
		/** Stripe webhook signing secret (Stripe Dashboard > Webhooks > Signing secret). */
		STRIPE_WEBHOOK_SECRET: string;

		// ── Order system ─────────────────────────────────────────────────
		/** Shared secret authenticating cron job requests (e.g. order expiry). */
		CRON_SECRET: string;

		/** Discord webhook URL for admin notifications (bank transfers, pickup slots). */
		DISCORD_WEBHOOK_URL?: string;

		// ── Public / client-side config ──────────────────────────────────
		/** Minimum items to trigger a discount. Defaults to "2" in code. */
		NEXT_PUBLIC_MINIMUM_ITEMS_FOR_DISCOUNT?: string;
		/** Discount percentage when the threshold is met. Defaults to "0" in code. */
		NEXT_PUBLIC_DISCOUNT_PERCENT?: string;

		// ── Headless asset hosting ───────────────────────────────────────
		/**
		 * Public origin serving Next.js static assets (`/_next/static/*`, `/_next/image`).
		 * Set to the R2 assets bucket URL for a headless setup; leave unset locally.
		 */
		NEXT_PUBLIC_ASSET_PREFIX?: string;

		// ── Build-time R2 asset upload ───────────────────────────────────
		/** R2 bucket used by `scripts/upload-assets.mts` to host built `.next/static/*` and `public/*`. Provisioned via Terraform. */
		R2_ASSETS_BUCKET?: string;
	}
}
