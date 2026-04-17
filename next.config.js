const { withPayload } = require("@payloadcms/next/withPayload");

/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	// Produce a self-contained build for Docker / Cloudflare Containers.
	// This traces only the files actually needed at runtime so the final
	// image stays well under 500 MB.
	output: "standalone",
	typescript: {
		ignoreBuildErrors: false,
	},
	serverExternalPackages: ["jose", "pdfjs-dist"],
};

module.exports = withPayload(nextConfig);
