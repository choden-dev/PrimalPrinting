import { withPayload } from "@payloadcms/next/withPayload";
import type { NextConfig } from "next";

// ── Headless asset hosting ─────────────────────────────────────────────────
// When NEXT_PUBLIC_ASSET_PREFIX is set (e.g. https://assets.primalprinting.com)
// Next.js will rewrite all references to files under /_next/static/* and
// /_next/image to that origin. Combined with the upload step in
// scripts/upload-assets.mts (which mirrors .next/static -> R2), this removes
// asset-serving load from the standalone Next server entirely.
//
// Leave the env var unset for local dev — Next will serve assets itself.
const assetPrefix = process.env.NEXT_PUBLIC_ASSET_PREFIX?.trim() || undefined;

const nextConfig: NextConfig = {
	reactStrictMode: true,
	// Produce a self-contained build for Docker / Cloudflare Containers.
	// This traces only the files actually needed at runtime so the final
	// image stays well under 500 MB.
	output: "standalone",
	typescript: {
		ignoreBuildErrors: false,
	},
	serverExternalPackages: ["jose", "pdfjs-dist"],
	// Inline assetPrefix so the value is baked into the client bundle. The
	// docker-entrypoint.sh placeholder swap also rewrites this at container
	// startup, so the same image can be redeployed against different CDNs.
	...(assetPrefix ? { assetPrefix } : {}),
};

export default withPayload(nextConfig);
