/**
 * Thin Worker entrypoint for Cloudflare Containers.
 *
 * Every incoming request is forwarded to the Next.js server running
 * inside the Container via a Durable Object stub. The Container
 * maintains a persistent Node.js process with pooled MongoDB
 * connections — no cold-start penalty on every request.
 */

import { env } from "cloudflare:workers";
import { Container, getContainer } from "@cloudflare/containers";

export class PrimalPrinting extends Container {
	defaultPort = 3000;

	// Called when a new container instance starts — use to pass secrets
	// and env vars from the Worker environment into the container.
	envVars = {
		NODE_ENV: "production",
		PORT: "3000",
		HOSTNAME: "0.0.0.0",
		// Database
		DATABASE_URI: env.DATABASE_URI ?? "",
		MONGODB_URI: env.DATABASE_URI ?? "",
		// Payload CMS
		PAYLOAD_SECRET: env.PAYLOAD_SECRET ?? "",
		NEXT_PUBLIC_BASE_URL: env.NEXT_PUBLIC_BASE_URL ?? "",
		// Auth
		NEXTAUTH_SECRET: env.NEXTAUTH_SECRET ?? "",
		NEXTAUTH_URL: env.NEXT_PUBLIC_BASE_URL ?? "",
		GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID ?? "",
		GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET ?? "",
		// R2 / S3 storage
		R2_BUCKET: env.R2_BUCKET ?? "primalprinting-media",
		R2_S3_ENDPOINT: env.R2_S3_ENDPOINT ?? "",
		R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID ?? "",
		R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY ?? "",
		R2_PUBLIC_URL: env.R2_PUBLIC_URL ?? "",
		R2_STAGING_BUCKET: env.R2_STAGING_BUCKET ?? "",
		R2_PERMANENT_BUCKET: env.R2_PERMANENT_BUCKET ?? "",
		// Stripe
		STRIPE_PRIVATE_KEY: env.STRIPE_PRIVATE_KEY ?? "",
		STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET ?? "",
		NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
			env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
		// Email
		GMAIL_USER: env.GMAIL_USER ?? "",
		GMAIL_PASS: env.GMAIL_PASS ?? "",
		// Discord
		DISCORD_WEBHOOK_URL: env.DISCORD_WEBHOOK_URL ?? "",
		// Cron
		CRON_SECRET: env.CRON_SECRET ?? "",
		// Public env vars (baked into client bundle at build time, but
		// still useful for server-side code that reads them)
		NEXT_PUBLIC_MINIMUM_ITEMS_FOR_DISCOUNT:
			env.NEXT_PUBLIC_MINIMUM_ITEMS_FOR_DISCOUNT ?? "2",
		NEXT_PUBLIC_DISCOUNT_PERCENT: env.NEXT_PUBLIC_DISCOUNT_PERCENT ?? "15",
		// Headless asset hosting — points Next.js at the R2 assets bucket
		// (or its custom domain) so the standalone server doesn't have to
		// serve any static files. Empty string falls back to same-origin.
		NEXT_PUBLIC_ASSET_PREFIX: env.NEXT_PUBLIC_ASSET_PREFIX ?? "",
	};
}

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const id = url.searchParams.get("id") || "singleton";
		// Get the container instance for the given session ID
		const containerInstance = getContainer(env.APP, id);
		// Pass the request to the container instance on its default port
		return containerInstance.fetch(request);
	},
};
