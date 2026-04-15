import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedCustomer } from "../../../../lib/auth";
import { uploadBankTransferProof } from "../../../../lib/r2";

/**
 * POST /api/shop/upload-proof — Upload a bank transfer proof image.
 *
 * Accepts multipart/form-data with:
 * - `image` (JPEG/PNG/WebP file, max 10MB)
 * - `orderNumber` (string)
 *
 * The image is automatically downsized to max 1200px width and converted
 * to WebP at 70% quality to prevent abuse / save storage.
 *
 * Returns the R2 key to attach to the order.
 */

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = [
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/jpg",
];

export async function POST(request: NextRequest) {
	const customer = await getAuthenticatedCustomer(request);
	if (!customer) {
		return NextResponse.json(
			{ error: "Authentication required." },
			{ status: 401 },
		);
	}

	try {
		const formData = await request.formData();
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

		if (!ALLOWED_IMAGE_TYPES.includes(image.type)) {
			return NextResponse.json(
				{ error: "Only JPEG, PNG, and WebP images are accepted." },
				{ status: 400 },
			);
		}

		if (image.size > MAX_IMAGE_SIZE) {
			return NextResponse.json(
				{
					error: `Image too large. Maximum size is ${MAX_IMAGE_SIZE / 1024 / 1024}MB.`,
				},
				{ status: 400 },
			);
		}

		const buffer = Buffer.from(await image.arrayBuffer());
		const proofKey = await uploadBankTransferProof(orderNumber, buffer);

		return NextResponse.json({
			success: true,
			proofKey,
		});
	} catch (error) {
		console.error("Error uploading proof:", error);
		return NextResponse.json(
			{ error: "Failed to upload proof image." },
			{ status: 500 },
		);
	}
}
