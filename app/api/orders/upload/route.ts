import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedCustomer } from "../../../../lib/auth";
import { generateStagingKey, uploadToStaging } from "../../../../lib/r2";

/**
 * POST /api/orders/upload — Upload a PDF file to the R2 staging bucket.
 *
 * Accepts multipart/form-data with:
 * - `file` (PDF file, max 20MB)
 * - `orderNumber` (string — used to namespace the staging key)
 *
 * Returns the staging key to include when creating/updating the order.
 */

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = ["application/pdf"];

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
		const file = formData.get("file") as File | null;
		const orderNumber = formData.get("orderNumber") as string | null;

		if (!file) {
			return NextResponse.json({ error: "No file provided." }, { status: 400 });
		}

		if (!ALLOWED_TYPES.includes(file.type)) {
			return NextResponse.json(
				{ error: "Only PDF files are accepted." },
				{ status: 400 },
			);
		}

		if (file.size > MAX_FILE_SIZE) {
			return NextResponse.json(
				{
					error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
				},
				{ status: 400 },
			);
		}

		// Use a temporary order number if one isn't provided yet
		const effectiveOrderNumber = orderNumber || `DRAFT-${customer.customerId}`;
		const stagingKey = generateStagingKey(effectiveOrderNumber, file.name);

		const buffer = Buffer.from(await file.arrayBuffer());
		await uploadToStaging(stagingKey, buffer, file.type);

		return NextResponse.json({
			success: true,
			stagingKey,
			fileName: file.name,
			fileSize: file.size,
		});
	} catch (error) {
		console.error("Error uploading file:", error);
		return NextResponse.json(
			{ error: "Failed to upload file." },
			{ status: 500 },
		);
	}
}
