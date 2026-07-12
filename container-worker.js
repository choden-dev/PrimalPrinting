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

	// Keep a warmed instance alive well past the default idle timeout so the
	// container does NOT scale to zero during normal gaps in traffic. Every
	// scale-to-zero forces the next visitor to pay the full container boot +
	// Next.js start + MongoDB connect/init on the critical path (the "insanely
	// long load / timeout for the first user" symptom). With `sleepAfter` the
	// instance only sleeps after a genuinely idle window, so the vast majority
	// of visitors reuse an already-running process with pooled Mongo
	// connections. Trade-off: a warm instance accrues (cheap) idle billing —
	// acceptable here for a single low-traffic storefront (max_instances: 1).
	sleepAfter = "20m";

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

	/**
	 * Override the base `containerFetch` purely to widen the port-ready
	 * timeout on a genuine cold start.
	 *
	 * The @cloudflare/containers base class, when the container isn't already
	 * running/healthy, calls `startAndWaitForPorts(port, { abort: request.signal })`
	 * with NO `portReadyTimeoutMS`, so it falls back to the library default of
	 * 20s (`TIMEOUT_TO_GET_PORTS_MS`). A cold boot here has to: pull/boot the
	 * container, run the docker entrypoint's NEXT_PUBLIC_* placeholder swap,
	 * start the Next.js standalone server, and only THEN bind port 3000. On a
	 * cold instance that whole chain can exceed 20s, at which point Cloudflare's
	 * proxy gives up with:
	 *   "Error proxying request to container: Container is taking too long to
	 *    accept the connection; the application could be overwhelmed with load"
	 *
	 * Waiting longer for the port to come up (instead of failing at 20s) lets
	 * the first visitor after a cold start actually reach the server. The
	 * keep-warm cron + `sleepAfter` still make cold starts rare; this just stops
	 * the rare cold start from erroring out. We keep passing the incoming
	 * request's abort signal so a client that goes away still cancels the wait.
	 */
	async containerFetch(requestOrUrl, portOrInit, portParam) {
		const state = await this.state.getState();
		const needsColdStart =
			!this.container.running || state.status !== "healthy";
		if (needsColdStart) {
			// Proactively start the container and wait for the port with a
			// generous timeout BEFORE delegating to the base implementation
			// (whose internal wait uses the short 20s default). Once the port
			// is ready, the base `containerFetch` sees a healthy container and
			// skips its own wait entirely.
			const port = this.defaultPort ?? PrimalPrinting.COLD_START_PORT;
			try {
				await this.startAndWaitForPorts({
					ports: port,
					cancellationOptions: {
						// 3× the library default — enough headroom for a cold
						// boot + entrypoint swap + Next.js start on a fresh
						// instance without waiting so long that a truly stuck
						// container hangs the request indefinitely.
						portReadyTimeoutMS: PrimalPrinting.COLD_START_PORT_TIMEOUT_MS,
					},
				});
			} catch (error) {
				console.warn(
					"[cold-start] startAndWaitForPorts failed, falling back to base fetch:",
					error,
				);
			}
		}
		return super.containerFetch(requestOrUrl, portOrInit, portParam);
	}
}

// Default port the container listens on (mirrors `defaultPort = 3000`), used
// only as a fallback when resolving the port to wait on during cold start.
PrimalPrinting.COLD_START_PORT = 3000;
// How long to wait for the container port to come up on a cold start before
// giving up. 60s = 3× the @cloudflare/containers default of 20s.
PrimalPrinting.COLD_START_PORT_TIMEOUT_MS = 60_000;

export default {
	async fetch(request, env) {
		// Always route to the single "singleton" instance. This app runs with
		// `max_instances: 1`, and the keep-warm cron (see `scheduled` below)
		// only pings the "singleton" instance. Previously the instance id was
		// derived from a `?id=` query param, so any request carrying an `id`
		// would be routed to a DIFFERENT, cold container instance that the
		// keep-warm ping never touched — that visitor would then pay the full
		// container boot + Next.js start + Mongo connect/init on their critical
		// path (the exact long-load / timeout symptom). Pinning every request
		// to "singleton" guarantees all traffic reuses the one warm process
		// with its live MongoDB connection pool.
		const containerInstance = getContainer(env.APP, "singleton");
		// Pass the request to the container instance on its default port
		return containerInstance.fetch(request);
	},

	/**
	 * Cron Trigger handler (see `triggers.crons` in wrangler.jsonc).
	 *
	 * Keep-warm ping: periodically hits the container's `/api/health` endpoint
	 * so the singleton instance never sits idle long enough to scale to zero
	 * (which, together with `sleepAfter` on the Container class, keeps the
	 * MongoDB connection pool alive). This eliminates the cold-start penalty —
	 * container boot + Next.js start + Mongo connect/init — that otherwise lands
	 * on the first real visitor after an idle period.
	 *
	 * Unlike GitHub Actions cron (min ~5min, frequently delayed and needs an
	 * external URL + shared secret), Worker Cron Triggers fire reliably and can
	 * reach the container directly through the Durable Object stub — the ping
	 * never leaves Cloudflare's network and needs no auth secret (the URL below
	 * uses the public origin only to satisfy `global_fetch_strictly_public`).
	 */
	async scheduled(_event, env, ctx) {
		const containerInstance = getContainer(env.APP, "singleton");
		// `containerInstance.fetch()` always routes internally via the Durable
		// Object stub regardless of the request URL, so the hostname here is only
		// used to construct a valid Request. Use the site's public origin (not a
		// made-up hostname like `https://internal/...`): the
		// `global_fetch_strictly_public` compatibility flag in wrangler.jsonc can
		// reject non-public hostnames, which would break the keep-warm ping.
		const baseUrl = env.NEXT_PUBLIC_BASE_URL || "https://primalprinting.co.nz";
		const healthUrl = new URL("/api/health", baseUrl).toString();
		const warm = containerInstance
			.fetch(new Request(healthUrl))
			.then(() => undefined)
			.catch((error) => {
				console.warn("[keep-warm] health ping failed:", error);
			});
		ctx.waitUntil(warm);
	},
};
