import { type NextRequest, NextResponse } from "next/server";
import { getPayloadClient } from "../../../../lib/payload";

/**
 * GET /api/shop/bank-details — Fetch bank account details for bank transfers.
 * Public endpoint — no auth required since customers need to see this
 * before making a transfer.
 */
export async function GET(_request: NextRequest) {
	try {
		const payload = await getPayloadClient();
		const bankDetails = await payload.findGlobal({ slug: "bank-details" });

		return NextResponse.json({
			success: true,
			bankDetails: {
				accountName: bankDetails.accountName || "",
				bankName: bankDetails.bankName || "",
				accountNumber: bankDetails.accountNumber || "",
				instructions: bankDetails.instructions || "",
			},
		});
	} catch {
		return NextResponse.json(
			{ error: "Bank details not configured." },
			{ status: 500 },
		);
	}
}
