"use client";

import { useDocumentInfo } from "@payloadcms/ui";
import { useCallback, useState } from "react";

interface OrderDocumentData {
	status?: string;
}

/**
 * Payload admin custom component: "Resend Confirmation Email" button.
 *
 * Shown on the order detail view for orders that are PAID or beyond.
 * Sends the appropriate confirmation email based on the order's current state.
 */
export const ResendConfirmationButton: React.FC = () => {
	const { id, initialData } = useDocumentInfo();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	const status = (initialData as OrderDocumentData)?.status;

	const handleResend = useCallback(async () => {
		if (!id) return;
		if (!window.confirm("Resend the confirmation email to this customer?")) {
			return;
		}

		setLoading(true);
		setError(null);
		setSuccess(null);

		try {
			const response = await fetch(`/api/shop/${id}/resend-confirmation`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to resend email.");
			}

			setSuccess(data.message || "Email sent successfully.");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error.");
		} finally {
			setLoading(false);
		}
	}, [id]);

	// Only show for orders that have been paid or beyond
	const validStatuses = ["PAID", "AWAITING_PICKUP", "PRINTED", "PICKED_UP"];
	if (!status || !validStatuses.includes(status)) return null;

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
			<h4
				style={{
					margin: "0 0 8px",
					color: success ? "#2e7d32" : "#e65100",
				}}
			>
				{success ? "✓ Email Sent" : "📧 Resend Confirmation Email"}
			</h4>

			{success ? (
				<p style={{ margin: 0, fontSize: "14px", color: "#2e7d32" }}>
					{success}
				</p>
			) : (
				<>
					<p
						style={{
							margin: "0 0 12px",
							fontSize: "14px",
							color: "#666",
						}}
					>
						Resend the order confirmation email to the customer. The email
						content will match the order's current state (payment method,
						timeslot selection, etc.).
					</p>
					<button
						type="button"
						onClick={handleResend}
						disabled={loading}
						style={{
							background: loading ? "#ccc" : "#ff9800",
							color: "#fff",
							border: "none",
							padding: "10px 24px",
							borderRadius: "6px",
							fontSize: "14px",
							fontWeight: 600,
							cursor: loading ? "not-allowed" : "pointer",
						}}
					>
						{loading ? "Sending…" : "📧 Resend Email"}
					</button>
				</>
			)}

			{error && (
				<p
					style={{
						color: "#d32f2f",
						marginTop: "8px",
						fontSize: "14px",
					}}
				>
					Error: {error}
				</p>
			)}
		</div>
	);
};

export default ResendConfirmationButton;
