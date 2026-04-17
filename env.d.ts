declare namespace NodeJS {
	interface ProcessEnv {
		NODE_ENV: "development" | "production" | "test";
		GMAIL_USER: string;
		GMAIL_PASS: string;
		/**
		 * @env NEXT_PUBLIC_BASE_URL
		 * The base URL of your application (e.g., https://yourdomain.com).
		 */
		NEXT_PUBLIC_BASE_URL: string;
		/**
		 * @env DATABASE_URI
		 * MongoDB connection string used by Payload CMS. Obtain from MongoDB Atlas or your MongoDB server.
		 */
		DATABASE_URI: string;
		/**
		 * @env PAYLOAD_SECRET
		 * Secret key used by Payload CMS for authentication and encryption.
		 * Generate a strong random string for production use.
		 */
		PAYLOAD_SECRET: string;
		/**
		 * @env R2_BUCKET
		 * Cloudflare R2 bucket name for Payload CMS media uploads.
		 */
		R2_BUCKET: string;
		/**
		 * @env R2_S3_ENDPOINT
		 * S3-compatible endpoint for the R2 bucket.
		 * Format: https://<ACCOUNT_ID>.r2.cloudflarestorage.com
		 */
		R2_S3_ENDPOINT: string;
		/**
		 * @env R2_ACCESS_KEY_ID
		 * R2 API token access key ID. Generate from the Cloudflare dashboard under R2 > Manage R2 API Tokens.
		 */
		R2_ACCESS_KEY_ID: string;
		/**
		 * @env R2_SECRET_ACCESS_KEY
		 * R2 API token secret access key. Generate from the Cloudflare dashboard under R2 > Manage R2 API Tokens.
		 */
		R2_SECRET_ACCESS_KEY: string;
		/**
		 * @env R2_PUBLIC_URL
		 * Public URL for serving R2 media (e.g. R2.dev subdomain or custom domain).
		 */
		R2_PUBLIC_URL: string;

		// ── Order system R2 buckets ──────────────────────────────────────
		/**
		 * @env R2_STAGING_BUCKET
		 * R2 bucket name for temporary order file storage (auto-expired after ~7 days).
		 */
		R2_STAGING_BUCKET: string;
		/**
		 * @env R2_PERMANENT_BUCKET
		 * R2 bucket name for permanent order file storage (retained after payment).
		 */
		R2_PERMANENT_BUCKET: string;

		// ── NextAuth / OAuth ─────────────────────────────────────────────
		/**
		 * @env NEXTAUTH_URL
		 * Canonical URL of the site. Used by NextAuth for callbacks.
		 * Derived from NEXT_PUBLIC_BASE_URL — do not set separately.
		 */
		NEXTAUTH_URL: string;
		/**
		 * @env NEXTAUTH_SECRET
		 * Random secret used by NextAuth to encrypt JWTs and cookies.
		 * Generate with: openssl rand -base64 32
		 */
		NEXTAUTH_SECRET: string;
		/**
		 * @env GOOGLE_CLIENT_ID
		 * Google OAuth 2.0 client ID. Obtain from Google Cloud Console > Credentials.
		 */
		GOOGLE_CLIENT_ID: string;
		/**
		 * @env GOOGLE_CLIENT_SECRET
		 * Google OAuth 2.0 client secret. Obtain from Google Cloud Console > Credentials.
		 */
		GOOGLE_CLIENT_SECRET: string;

		// ── Stripe ───────────────────────────────────────────────────────
		/**
		 * @env STRIPE_PRIVATE_KEY
		 * Stripe secret key for server-side API calls.
		 */
		STRIPE_PRIVATE_KEY: string;
		/**
		 * @env NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
		 * Stripe publishable key for client-side Stripe Elements.
		 */
		NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
		/**
		 * @env STRIPE_WEBHOOK_SECRET
		 * Stripe webhook signing secret for verifying webhook events.
		 * Obtain from Stripe Dashboard > Webhooks > Signing secret.
		 */
		STRIPE_WEBHOOK_SECRET: string;

		// ── Order system ─────────────────────────────────────────────────
		/**
		 * @env CRON_SECRET
		 * Shared secret to authenticate cron job requests (e.g. order expiry).
		 */
		CRON_SECRET: string;

		/**
		 * @env DISCORD_WEBHOOK_URL
		 * Discord webhook URL for sending admin notifications (e.g. new bank
		 * transfer submissions, pickup slot selections).
		 * Create one via Discord → Server Settings → Integrations → Webhooks.
		 */
		DISCORD_WEBHOOK_URL?: string;
	}
}
