const { withPayload } = require("@payloadcms/next/withPayload");

/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	typescript: {
		ignoreBuildErrors: false,
	},
	serverExternalPackages: ["jose", "canvas"],
};

module.exports = withPayload(nextConfig);

import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
