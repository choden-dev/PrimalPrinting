import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedCustomer } from "../../../../lib/auth";
import { checkBankTransferEligibility } from "../../../../lib/bankTransfer";
import { parseMultipartFormData } from "../../../../lib/formData";
import { uploadBankTransferProof } from "../../../../lib/r2";

/**
 * POST /api/shop/upload-proof — Upload a bank transfer proof image.
 *
 * Accepts multipart/form-data with:
 * - `image` (JPEG/PNG/WebP file, max 10MB)
 * - `orderNumber` (string)
 *
 * The image is uploaded as-is (no server-side resizing — sharp is not
 * available on Cloudflare Workers).
 *
 * Returns the R2 key to attach to the order.
 */

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
// Body cap — single image plus a generous slack for multipart overhead and
// the small `orderNumber` field. Anything larger is rejected before the
// runtime even attempts to parse the multipart payload.
const MAX_PROOF_BODY_SIZE = MAX_IMAGE_SIZE + 1024 * 1024;
const ALLOWED_IMAGE_TYPES = [
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/jpg",
];

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
	const customer = await getAuthenticatedCustomer(request);
	if (!customer) {
		return NextResponse.json(
			{ error: "Authentication required." },
			{ status: 401 },
		);
	}

	// Parse the multipart body via the shared safe helper so customers see a
	// clear, actionable error instead of the runtime's bare
	// "Failed to parse body as FormData" when the upload is too large or
	// gets truncated mid-stream.
	const parseResult = await parseMultipartFormData(
		request,
		MAX_PROOF_BODY_SIZE,
	);
	if (!parseResult.ok) {
		return NextResponse.json(
			{ error: parseResult.error.message },
			{ status: parseResult.error.status },
		);
	}
	const formData = parseResult.formData;

	try {
		const image = formData.get("image") as File | null;
		const orderNumber = formData.get("orderNumber") as string | null;

		if (!image) {
			return NextResponse.json(
				{ error: "No image provided." },
				{ status: 400 },
			);
		}

		if (!orderNumber) {
			return NextResponse.json(
				{ error: "orderNumber is required." },
				{ status: 400 },
			);
		}

		// Verify eligibility: owns the order, correct status, no pending verification
		const check = await checkBankTransferEligibility(customer.customerId, {
			orderNumber,
		});
		if (!check.eligible) {
			return NextResponse.json(
				{ error: check.error },
				{ status: check.status },
			);
		}

		if (!ALLOWED_IMAGE_TYPES.includes(image.type)) {
			return NextResponse.json(
				{
					error: `Unsupported image type "${image.type || "unknown"}". Only JPEG, PNG, and WebP images are accepted.`,
				},
				{ status: 400 },
			);
		}

		if (image.size > MAX_IMAGE_SIZE) {
			const mb = (image.size / 1024 / 1024).toFixed(1);
			return NextResponse.json(
				{
					error: `Image too large (${mb}MB). Maximum size is ${MAX_IMAGE_SIZE / 1024 / 1024}MB. Please compress or resize the image and try again.`,
				},
				{ status: 413 },
			);
		}

		const buffer = Buffer.from(await image.arrayBuffer());
		const proofKey = await uploadBankTransferProof(
			orderNumber,
			buffer,
			image.type,
		);

		return NextResponse.json({
			success: true,
			proofKey,
		});
	} catch (error) {
		console.error("Error uploading proof:", error);
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? `Failed to upload proof image: ${error.message}`
						: "Failed to upload proof image.",
			},
			{ status: 500 },
		);
	}
}
