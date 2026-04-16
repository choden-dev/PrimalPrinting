import { type NextRequest, NextResponse } from "next/server";
import { isPayloadAdmin } from "../../../../lib/auth";
import { getPresignedUrl } from "../../../../lib/r2";

/**
 * GET /api/admin/file-url?key=...&staging=true|false
 *
 * Admin-only endpoint that generates a presigned R2 URL for viewing/downloading
 * order files and bank transfer proofs.
 *
 * Returns a temporary URL valid for 1 hour.
 */
export async function GET(request: NextRequest) {
	if (!(await isPayloadAdmin(request))) {
		return NextResponse.json(
			{ error: "Admin access required." },
			{ status: 403 },
		);
	}

	const { searchParams } = new URL(request.url);
	const key = searchParams.get("key");
	const staging = searchParams.get("staging") === "true";

	if (!key) {
		return NextResponse.json(
			{ error: "key parameter is required." },
			{ status: 400 },
		);
	}

	try {
		const url = await getPresignedUrl(key, { staging, expiresIn: 3600 });
		return NextResponse.json({ success: true, url });
	} catch (error) {
		console.error("Error generating presigned URL:", error);
		return NextResponse.json(
			{ error: "Failed to generate file URL." },
			{ status: 500 },
		);
	}
}
