"use client";

import { useDocumentInfo } from "@payloadcms/ui";
import { useCallback, useEffect, useState } from "react";

interface TimeslotDocumentData {
	label?: string;
	date?: string;
	startTime?: string;
	endTime?: string;
}

/** Default message pre-filled into the textarea; the admin can edit or clear it. */
function buildDefaultMessage(slot: TimeslotDocumentData): string {
	const when = [slot.date, slot.startTime && `at ${slot.startTime}`]
		.filter(Boolean)
		.join(" ");
	const slotText = when ? ` (${when})` : "";
	return [
		`We're really sorry, but we've had to remove the pickup slot you booked${slotText}.`,
		"Please head to your orders page to choose a new pickup time that works for you. Thanks so much for your patience and understanding.",
	].join("\n\n");
}

/**
 * Payload admin custom component shown on the Timeslot edit view.
 *
 * Replaces the generic "delete" flow with a confirmation that lets the admin
 * write a personalised message. On confirm, it deletes the timeslot and emails
 * every customer booked into it (clearing their pickup selection so they can
 * re-book).
 */
export const DeleteTimeslotButton: React.FC = () => {
	const { id, initialData } = useDocumentInfo();
	const slot = (initialData as TimeslotDocumentData) || {};

	const [open, setOpen] = useState(false);
	const [message, setMessage] = useState("");
	const [affected, setAffected] = useState<number | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	// When the modal opens, seed the default message and fetch how many orders
	// are booked into this slot so the admin knows how many will be notified.
	useEffect(() => {
		if (!open || !id) return;
		setMessage(buildDefaultMessage(slot));
		setAffected(null);
		setError(null);

		let cancelled = false;
		(async () => {
			try {
				const res = await fetch(`/api/admin/timeslots/${id}/delete`);
				if (!res.ok) return;
				const data = (await res.json()) as { affectedOrders?: number };
				if (!cancelled && typeof data.affectedOrders === "number") {
					setAffected(data.affectedOrders);
				}
			} catch {
				// Non-fatal: the count is informational only.
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [open, id, slot]);

	const handleDelete = useCallback(async () => {
		if (!id) return;
		setLoading(true);
		setError(null);

		try {
			const res = await fetch(`/api/admin/timeslots/${id}/delete`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ message }),
			});

			const data = (await res.json()) as {
				error?: string;
				notified?: number;
			};

			if (!res.ok) {
				throw new Error(data.error || "Failed to delete timeslot.");
			}

			setSuccess(
				`Timeslot deleted. Notified ${data.notified ?? 0} customer(s). Redirecting…`,
			);
			// Send the admin back to the timeslots list.
			setTimeout(() => {
				window.location.href = "/admin/collections/timeslots";
			}, 1200);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error.");
			setLoading(false);
		}
	}, [id, message]);

	// Only meaningful once the document has been created/saved.
	if (!id) return null;

	return (
		<div style={{ marginBottom: 16 }}>
			<button
				type="button"
				onClick={() => setOpen(true)}
				style={{
					background: "#fff",
					color: "#c62828",
					border: "2px solid #c62828",
					padding: "10px 20px",
					borderRadius: 6,
					fontSize: 14,
					fontWeight: 600,
					cursor: "pointer",
				}}
			>
				🗑️ Delete timeslot & notify customers
			</button>

			{open && (
				<div
					style={{
						position: "fixed",
						inset: 0,
						background: "rgba(0,0,0,0.5)",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						zIndex: 1000,
						padding: 16,
					}}
				>
					<div
						style={{
							background: "#fff",
							borderRadius: 10,
							padding: 24,
							width: "100%",
							maxWidth: 520,
							boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
						}}
					>
						<h3 style={{ margin: "0 0 8px", color: "#1a1a2e" }}>
							Delete this timeslot?
						</h3>
						<p style={{ margin: "0 0 12px", fontSize: 14, color: "#555" }}>
							This permanently deletes the slot. Every customer booked into it
							will be emailed and asked to choose a new pickup time.
							{affected !== null && (
								<>
									{" "}
									<strong>
										{affected === 0
											? "No orders are booked into this slot."
											: `${affected} order(s) will be notified.`}
									</strong>
								</>
							)}
						</p>

						<label
							htmlFor="timeslot-delete-message"
							style={{
								display: "block",
								fontSize: 13,
								fontWeight: 600,
								marginBottom: 6,
								color: "#333",
							}}
						>
							Message to customers (shown as "A note from us")
						</label>
						<textarea
							id="timeslot-delete-message"
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							rows={6}
							disabled={loading}
							style={{
								width: "100%",
								boxSizing: "border-box",
								padding: 10,
								borderRadius: 6,
								border: "1px solid #ccc",
								fontSize: 14,
								fontFamily: "inherit",
								resize: "vertical",
							}}
						/>
						<p style={{ margin: "6px 0 0", fontSize: 12, color: "#888" }}>
							Leave blank to send only the standard apology.
						</p>

						{error && (
							<p style={{ color: "#d32f2f", marginTop: 10, fontSize: 14 }}>
								Error: {error}
							</p>
						)}
						{success && (
							<p style={{ color: "#2e7d32", marginTop: 10, fontSize: 14 }}>
								{success}
							</p>
						)}

						<div
							style={{
								display: "flex",
								justifyContent: "flex-end",
								gap: 8,
								marginTop: 20,
							}}
						>
							<button
								type="button"
								onClick={() => setOpen(false)}
								disabled={loading}
								style={{
									background: "#f0f0f0",
									color: "#333",
									border: "none",
									padding: "10px 20px",
									borderRadius: 6,
									fontSize: 14,
									fontWeight: 600,
									cursor: loading ? "not-allowed" : "pointer",
								}}
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={handleDelete}
								disabled={loading || Boolean(success)}
								style={{
									background: loading ? "#ccc" : "#c62828",
									color: "#fff",
									border: "none",
									padding: "10px 20px",
									borderRadius: 6,
									fontSize: 14,
									fontWeight: 600,
									cursor: loading ? "not-allowed" : "pointer",
								}}
							>
								{loading ? "Deleting…" : "Delete & notify"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default DeleteTimeslotButton;
