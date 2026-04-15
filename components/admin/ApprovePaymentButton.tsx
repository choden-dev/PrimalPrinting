"use client";

import { useDocumentInfo } from "@payloadcms/ui";
import { useCallback, useState } from "react";

interface OrderDocumentData {
	status?: string;
}

/**
 * Payload admin custom component: "Approve Payment" button.
 *
 * Shown on the order detail view when status === PAYMENT_PENDING_VERIFICATION.
 * Calls the approve-payment API endpoint and refreshes the page on success.
 */
export const ApprovePaymentButton: React.FC = () => {
	const { id, initialData } = useDocumentInfo();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	const status = (initialData as OrderDocumentData)?.status;

	const handleApprove = useCallback(async () => {
		if (!id) return;
		if (
			!window.confirm(
				"Are you sure you want to approve this bank transfer payment? This will transfer files to permanent storage.",
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
				throw new Error(data.error || "Failed to approve payment.");
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

	// Only show for orders pending verification
	if (status !== "PAYMENT_PENDING_VERIFICATION") return null;

	return (
		<div
			style={{
				padding: "16px",
				marginBottom: "16px",
				background: success ? "#e8f5e9" : "#fff3e0",
				borderRadius: "8px",
				border: `2px solid ${success ? "#4caf50" : "#ff9800"}`,
			}}
		>
			<h4 style={{ margin: "0 0 8px", color: success ? "#2e7d32" : "#e65100" }}>
				{success
					? "✓ Payment Approved"
					: "⏳ Bank Transfer Pending Verification"}
			</h4>

			{!success && (
				<>
					<p style={{ margin: "0 0 12px", fontSize: "14px", color: "#666" }}>
						Review the bank transfer proof below before approving. Approval will
						transfer files to permanent storage and mark the order as paid.
					</p>
					<button
						type="button"
						onClick={handleApprove}
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
						{loading ? "Approving…" : "✓ Approve Payment"}
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
