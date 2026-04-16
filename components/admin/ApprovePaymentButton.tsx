"use client";

import { useDocumentInfo } from "@payloadcms/ui";
import { useCallback, useState } from "react";

interface OrderDocumentData {
	status?: string;
	paymentMethod?: string;
	bankTransferVerified?: boolean;
}

/**
 * Payload admin custom component: "Verify Payment" button.
 *
 * Shown on the order detail view for bank transfer orders that haven't been verified yet.
 * This is optional — for record keeping only. The order is already PAID.
 * Calls the approve-payment API endpoint and refreshes the page on success.
 */
export const ApprovePaymentButton: React.FC = () => {
	const { id, initialData } = useDocumentInfo();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	const data = initialData as OrderDocumentData;
	const paymentMethod = data?.paymentMethod;
	const bankTransferVerified = data?.bankTransferVerified;

	const handleVerify = useCallback(async () => {
		if (!id) return;
		if (
			!window.confirm(
				"Mark this bank transfer payment as verified? This is for record keeping only.",
			)
		) {
			return;
		}

		setLoading(true);
		setError(null);

		try {
			const response = await fetch(`/api/shop/${id}/approve-payment`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || "Failed to verify payment.");
			}

			setSuccess(true);
			// Reload to reflect updated status
			setTimeout(() => window.location.reload(), 1000);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error.");
		} finally {
			setLoading(false);
		}
	}, [id]);

	// Only show for bank transfer orders that haven't been verified
	if (paymentMethod !== "BANK_TRANSFER") return null;
	if (bankTransferVerified) {
		return (
			<div
				style={{
					padding: "16px",
					marginBottom: "16px",
					background: "#e8f5e9",
					borderRadius: "8px",
					border: "2px solid #4caf50",
				}}
			>
				<h4 style={{ margin: 0, color: "#2e7d32" }}>
					✓ Bank Transfer Verified
				</h4>
			</div>
		);
	}

	return (
		<div
			style={{
				padding: "16px",
				marginBottom: "16px",
				background: success ? "#e8f5e9" : "#e3f2fd",
				borderRadius: "8px",
				border: `2px solid ${success ? "#4caf50" : "#1976d2"}`,
			}}
		>
			<h4 style={{ margin: "0 0 8px", color: success ? "#2e7d32" : "#1565c0" }}>
				{success
					? "✓ Payment Verified"
					: "🏦 Bank Transfer — Not Yet Verified"}
			</h4>

			{!success && (
				<>
					<p style={{ margin: "0 0 12px", fontSize: "14px", color: "#666" }}>
						This bank transfer payment has not been verified yet. Verification is
						optional and for record keeping only — the customer can already
						proceed.
					</p>
					<button
						type="button"
						onClick={handleVerify}
						disabled={loading}
						style={{
							background: loading ? "#ccc" : "#4caf50",
							color: "#fff",
							border: "none",
							padding: "10px 24px",
							borderRadius: "6px",
							fontSize: "14px",
							fontWeight: 600,
							cursor: loading ? "not-allowed" : "pointer",
						}}
					>
						{loading ? "Verifying…" : "✓ Mark as Verified"}
					</button>
				</>
			)}

			{error && (
				<p style={{ color: "#d32f2f", marginTop: "8px", fontSize: "14px" }}>
					Error: {error}
				</p>
			)}
		</div>
	);
};

export default ApprovePaymentButton;
