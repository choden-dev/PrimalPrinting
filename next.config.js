const { withPayload } = require("@payloadcms/next/withPayload");

/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	typescript: {
		ignoreBuildErrors: false,
	},
	// Required for Cloudflare Workers deployment (opennextjs-cloudflare).
	// These packages are transitive deps that pnpm's strict hoisting prevents
	// esbuild from resolving during the OpenNext build. Adding them here ensures
	// Next.js NFT traces them into .open-next/server-functions/default/node_modules/.
	// - jose: used by payload for JWT auth (auth/operations/me.js, auth/strategies/jwt.js)
	// - pdfjs-dist: only used client-side, but gets traced into server bundle where
	//   it tries to require("canvas") which is a native addon incompatible with Workers
	serverExternalPackages: ["jose", "pdfjs-dist"],
};

module.exports = withPayload(nextConfig);

import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
