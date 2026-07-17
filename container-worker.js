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

	// Readiness probe target. The base class treats any completed fetch as
	// "ready" without inspecting status, so we point it at a real (but cheap)
	// app route rather than the default bare TCP-accept probe: that only proves
	// the port bound, not that Next.js is actually routing. We use `/api/ready`
	// (not `/api/health`) because it touches no DB/Payload and returns as soon
	// as the router is up — `/api/health` can block on a cold Mongo connect and
	// exceed the library's per-probe timeout. Host must be explicit.
	pingEndpoint = "localhost:3000/api/ready";

	// Keep a warmed instance alive past the default idle timeout so it does not
	// scale to zero during normal traffic gaps; every scale-to-zero forces the
	// next visitor to pay the full boot + Next.js start + Mongo connect. Cost:
	// cheap idle billing, acceptable for a single low-traffic storefront.
	sleepAfter = "20m";

	// Secrets and env vars passed from the Worker environment into the container.
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
		// Shop timezone — used to interpret timeslot date/time strings when
		// enforcing the minimum notice period. Keep the default in sync with
		// the code fallback in lib/scheduleGenerator.ts and .env.local.
		SHOP_TIMEZONE: env.SHOP_TIMEZONE ?? "Pacific/Auckland",
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
	 * Override the base `containerFetch` to widen the cold-start timeouts.
	 *
	 * The base class waits for the port with the library's short defaults (8s
	 * to provision + 20s port-ready). A genuine cold boot here (image pull +
	 * entrypoint placeholder swap + Next.js start) can exceed those, so the
	 * proxy fails with "Container is taking too long to accept the connection".
	 * We proactively start and wait with a longer budget so the first visitor
	 * after a cold start still reaches the server; keep-warm + `sleepAfter`
	 * keep such cold starts rare.
	 */
	async containerFetch(requestOrUrl, portOrInit, portParam) {
		const state = await this.state.getState();
		const needsColdStart =
			!this.container.running || state.status !== "healthy";
		if (needsColdStart) {
			// Wait for the port with a generous timeout before delegating; once
			// ready, the base `containerFetch` sees a healthy container and skips
			// its own (short-default) wait.
			const port = this.defaultPort ?? PrimalPrinting.COLD_START_PORT;
			try {
				await this.startAndWaitForPorts({
					ports: port,
					cancellationOptions: {
						portReadyTimeoutMS: PrimalPrinting.COLD_START_PORT_TIMEOUT_MS,
						// Also widen provisioning: the library has a separate
						// instance-get timeout (default 8s) that a cold image
						// pull + schedule can exceed, failing before the
						// port-ready wait is even reached.
						instanceGetTimeoutMS:
							PrimalPrinting.COLD_START_INSTANCE_GET_TIMEOUT_MS,
					},
				});
			} catch (error) {
				console.warn(
					"[cold-start] startAndWaitForPorts failed, falling back to base fetch:",
					error,
				);
			}
		}
		// Proxy the request, retrying only the transient proxy-stage 500 the
		// base class surfaces after the port is ready (the "taking too long to
		// accept the connection" blip when the port TCP-accepts but Next.js
		// isn't quite serving). The base class does not retry it; a short
		// bounded retry lets that sub-second gap pass. See #fetchWithProxyRetry.
		return this.#fetchWithProxyRetry(requestOrUrl, portOrInit, portParam);
	}

	/**
	 * Delegate to the base `containerFetch`, retrying only the transient
	 * "Error proxying request to container … taking too long to accept the
	 * connection" 500 a small, bounded number of times with backoff.
	 */
	async #fetchWithProxyRetry(requestOrUrl, portOrInit, portParam) {
		const maxAttempts = PrimalPrinting.PROXY_RETRY_MAX_ATTEMPTS;

		// Only idempotent requests (GET/HEAD/OPTIONS) may be auto-retried:
		// retrying a mutating request risks a consumed single-use body and/or a
		// duplicate side effect if the drop happened after the handler ran. The
		// idempotent page loads/navigations are exactly what dominates traffic
		// right after a cold start, so this still covers the reported symptom;
		// mutating POSTs pass through once.
		const isRequest = requestOrUrl instanceof Request;
		const method = isRequest ? requestOrUrl.method.toUpperCase() : "GET";
		const isIdempotent =
			method === "GET" || method === "HEAD" || method === "OPTIONS";

		let lastResponse;
		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			// Clone per attempt so the (empty, for idempotent methods) body
			// stream is never reused across retries; non-Request callers pass
			// through unchanged.
			const attemptTarget = isRequest ? requestOrUrl.clone() : requestOrUrl;
			lastResponse = await super.containerFetch(
				attemptTarget,
				portOrInit,
				portParam,
			);
			// Only the transient proxy 500 on an idempotent request is
			// retryable. Anything else (success, redirects, 4xx, a different
			// 500, or ANY non-idempotent request) is returned as-is.
			if (
				lastResponse.status !== 500 ||
				!isIdempotent ||
				attempt === maxAttempts ||
				(isRequest && requestOrUrl.signal?.aborted)
			) {
				return lastResponse;
			}
			// Peek at the body WITHOUT consuming the response we might return:
			// clone first so a non-matching body can still be handed back intact.
			let bodyText = "";
			try {
				bodyText = await lastResponse.clone().text();
			} catch {
				// If the body can't be read, treat it as non-retryable.
				return lastResponse;
			}
			if (!PrimalPrinting.TRANSIENT_PROXY_ERROR_RE.test(bodyText)) {
				return lastResponse;
			}
			console.warn(
				`[proxy-retry] transient container proxy error (attempt ${attempt}/${maxAttempts}), retrying:`,
				bodyText.slice(0, 200),
			);
			await scheduler.wait(PrimalPrinting.PROXY_RETRY_BACKOFF_MS * attempt);
		}
		return lastResponse;
	}

	/**
	 * Keep-warm entrypoint invoked by the Worker's `scheduled` (cron) handler.
	 *
	 * Wakes the container with the same widened cold-start budget used on the
	 * request path, rather than a plain `fetch("/api/health")` whose short
	 * library-default wait can time out (and leave the instance asleep) after a
	 * genuine scale-to-zero. This moves the rare cold start off the visitor's
	 * critical path. Callers should treat a thrown error as non-fatal (retry
	 * next tick).
	 */
	async keepWarm() {
		const state = await this.state.getState();
		const alreadyWarm = this.container.running && state.status === "healthy";
		if (!alreadyWarm) {
			const port = this.defaultPort ?? PrimalPrinting.COLD_START_PORT;
			await this.startAndWaitForPorts({
				ports: port,
				cancellationOptions: {
					portReadyTimeoutMS: PrimalPrinting.COLD_START_PORT_TIMEOUT_MS,
					instanceGetTimeoutMS:
						PrimalPrinting.COLD_START_INSTANCE_GET_TIMEOUT_MS,
				},
			});
		}
		// Touch /api/health so the Payload/Mongo pool is exercised (a real wire
		// round-trip), keeping the DB layer hot, not just the HTTP server.
		const baseUrl =
			PrimalPrinting.KEEP_WARM_BASE_URL || "https://primalprinting.co.nz";
		const healthUrl = new URL("/api/health", baseUrl).toString();
		await this.containerFetch(new Request(healthUrl));
	}

	/**
	 * Diagnostic lifecycle hooks. The base class defaults are silent, leaving
	 * the opaque proxy error as the only signal when a cold start misbehaves.
	 * These emit greppable logs so the proxy error can be correlated with the
	 * container's actual lifecycle (booted / clean sleep vs crash-OOM / error).
	 * Purely observational: onStart/onStop stay no-ops and onError rethrows to
	 * preserve the library's error contract.
	 */
	onStart() {
		console.log("[container] onStart — instance started and port bound");
	}

	onStop({ exitCode, reason }) {
		// A clean idle sleep exits 0 via SIGTERM; anything else is suspicious
		// (a crash-loop or OOM here is a prime suspect for the recurring
		// "Container is taking too long to accept the connection" proxy error).
		const unexpected = exitCode !== 0 || reason === "runtime_signal";
		const log = unexpected ? console.warn : console.log;
		log(
			`[container] onStop — exitCode=${exitCode} reason=${reason}` +
				(unexpected
					? " (UNEXPECTED — possible crash/OOM; next cold start may fail to accept connections)"
					: " (clean shutdown/idle sleep)"),
		);
	}

	onError(error) {
		console.error("[container] onError — container reported an error:", error);
		// Preserve the base class's contract of surfacing the error.
		throw error;
	}
}

// Fallback port when resolving the port to wait on during cold start.
PrimalPrinting.COLD_START_PORT = 3000;
// Cold-start port-ready timeout: 60s = 3× the library default of 20s.
PrimalPrinting.COLD_START_PORT_TIMEOUT_MS = 60_000;
// Cold-start provisioning (instance-get) timeout: 30s vs the library default
// of 8s — headroom for image pull + scheduling, kept below the port timeout.
PrimalPrinting.COLD_START_INSTANCE_GET_TIMEOUT_MS = 30_000;
// #fetchWithProxyRetry tuning: initial try + 2 retries with linear backoff
// (250ms, 500ms) so worst-case added latency stays under 1s.
PrimalPrinting.PROXY_RETRY_MAX_ATTEMPTS = 3;
PrimalPrinting.PROXY_RETRY_BACKOFF_MS = 250;
// Matches the base class's transient proxy-stage 500 bodies: the generic
// "proxying request to container" / "taking too long to accept the connection"
// failures plus the "suddenly disconnected" / "Network connection lost"
// restart case (which the library flags as retryable but does not retry).
// Broad enough to survive wording drift, specific enough to skip unrelated 500s.
PrimalPrinting.TRANSIENT_PROXY_ERROR_RE =
	/proxying request to container|taking too long to accept the connection|suddenly disconnected|network connection lost/i;
// Origin for the keepWarm /api/health Request. Routing is internal via the DO
// stub, but `global_fetch_strictly_public` rejects non-public hostnames.
PrimalPrinting.KEEP_WARM_BASE_URL = "https://primalprinting.co.nz";

export default {
	async fetch(request, env) {
		// Always route to the single "singleton" instance (max_instances: 1).
		// The keep-warm cron only warms "singleton", so pinning all traffic here
		// guarantees every request reuses the one warm process with its live
		// Mongo pool, rather than a cold instance keyed off a `?id=` param.
		const containerInstance = getContainer(env.APP, "singleton");
		return containerInstance.fetch(request);
	},

	/**
	 * Cron Trigger handler (see `triggers.crons` in wrangler.jsonc).
	 *
	 * Keep-warm ping so the singleton never idles long enough to scale to zero
	 * (which, with `sleepAfter`, keeps the Mongo pool alive), moving the
	 * cold-start penalty off the first visitor after an idle period. Worker Cron
	 * Triggers reach the container directly via the DO stub — no external URL or
	 * auth secret needed, unlike GitHub Actions cron.
	 */
	async scheduled(_event, env, ctx) {
		const containerInstance = getContainer(env.APP, "singleton");
		// Use the `keepWarm()` RPC rather than a plain `fetch("/api/health")`: a
		// plain fetch uses the short library-default wake-up wait, which can time
		// out after a real scale-to-zero and leave the container asleep.
		// keepWarm() wakes it with the widened cold-start budget instead.
		const warm = Promise.resolve(containerInstance.keepWarm())
			.then(() => undefined)
			.catch((error) => {
				console.warn("[keep-warm] warm-up failed:", error);
			});
		ctx.waitUntil(warm);
	},
};
