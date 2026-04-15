"use client";

import { useDocumentInfo } from "@payloadcms/ui";
import { useCallback, useState } from "react";

/**
 * Payload admin custom component: "Mark as Picked Up" button.
 *
 * Shown on the order detail view when status === READY_FOR_PICKUP.
 * Transitions the order to PICKED_UP and sets the pickedUpAt timestamp.
 */
export const MarkPickedUpButton: React.FC = () => {
	const { id, initialData } = useDocumentInfo();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	const status = (initialData as any)?.status;

	const handleMarkPickedUp = useCallback(async () => {
		if (!id) return;
		if (
			!window.confirm(
				"Mark this order as picked up? This action cannot be undone.",
			)
		) {
			return;
		}

		setLoading(true);
		setError(null);

		try {
			const response = await fetch(`/api/orders/${id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status: "PICKED_UP" }),
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || "Failed to mark as picked up.");
			}

			setSuccess(true);
			setTimeout(() => window.location.reload(), 1000);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error.");
		} finally {
			setLoading(false);
		}
	}, [id]);

	// Only show for orders ready for pickup
	if (status !== "READY_FOR_PICKUP") return null;

	return (
		<div
			style={{
				padding: "16px",
				marginBottom: "16px",
				background: success ? "#e8f5e9" : "#e3f2fd",
				borderRadius: "8px",
				border: `2px solid ${success ? "#4caf50" : "#2196f3"}`,
			}}
		>
			<h4 style={{ margin: "0 0 8px", color: success ? "#2e7d32" : "#1565c0" }}>
				{success ? "✓ Marked as Picked Up" : "📦 Ready for Pickup"}
			</h4>

			{!success && (
				<>
					<p style={{ margin: "0 0 12px", fontSize: "14px", color: "#666" }}>
						Click below once the customer has collected their order.
					</p>
					<button
						type="button"
						onClick={handleMarkPickedUp}
						disabled={loading}
						style={{
							background: loading ? "#ccc" : "#2196f3",
							color: "#fff",
							border: "none",
							padding: "10px 24px",
							borderRadius: "6px",
							fontSize: "14px",
							fontWeight: 600,
							cursor: loading ? "not-allowed" : "pointer",
						}}
					>
						{loading ? "Updating…" : "📦 Mark as Picked Up"}
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

export default MarkPickedUpButton;
