const { withPayload } = require("@payloadcms/next/withPayload");

/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	typescript: {
		ignoreBuildErrors: false,
	},
	serverExternalPackages: ["jose", "pdfjs-dist"],
};

module.exports = withPayload(nextConfig);

import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
