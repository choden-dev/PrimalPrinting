"use client";

import { useCallback, useEffect, useState } from "react";

interface Timeslot {
	id: string;
	date: string;
	startTime: string;
	endTime: string;
	label: string;
}

interface TimeslotSelectorProps {
	orderId: string;
	onSuccess: (timeslot: Timeslot) => void;
	onError?: (error: string) => void;
}

/**
 * Pickup timeslot selector component.
 *
 * Fetches available timeslots from the API and lets the customer
 * pick one for their paid order. Grouped by date for easy scanning.
 *
 * ```tsx
 * <TimeslotSelector
 *   orderId={order.id}
 *   onSuccess={(slot) => console.log("Selected:", slot)}
 * />
 * ```
 */
export function TimeslotSelector({
	orderId,
	onSuccess,
	onError,
}: TimeslotSelectorProps) {
	const [timeslots, setTimeslots] = useState<Timeslot[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		async function fetchTimeslots() {
			try {
				const res = await fetch("/api/timeslots");
				const data = await res.json();
				if (!res.ok)
					throw new Error(data.error || "Failed to fetch timeslots.");
				setTimeslots(data.timeslots || []);
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "Failed to load timeslots.",
				);
			} finally {
				setLoading(false);
			}
		}
		fetchTimeslots();
	}, []);

	const handleConfirm = useCallback(async () => {
		if (!selectedId) return;

		setSubmitting(true);
		setError(null);

		try {
			const res = await fetch(`/api/orders/${orderId}/select-timeslot`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ timeslotId: selectedId }),
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || "Failed to select timeslot.");
			}

			const selected = timeslots.find((t) => t.id === selectedId);
			if (selected) onSuccess(selected);
		} catch (err) {
			const msg =
				err instanceof Error ? err.message : "Failed to select timeslot.";
			setError(msg);
			onError?.(msg);
		} finally {
			setSubmitting(false);
		}
	}, [selectedId, orderId, timeslots, onSuccess, onError]);

	// Group timeslots by date
	const grouped = timeslots.reduce<Record<string, Timeslot[]>>((acc, slot) => {
		const dateKey = slot.date?.split("T")[0] || "unknown";
		if (!acc[dateKey]) acc[dateKey] = [];
		acc[dateKey].push(slot);
		return acc;
	}, {});

	if (loading) {
		return (
			<div style={{ textAlign: "center", padding: "24px", color: "#666" }}>
				Loading available timeslots…
			</div>
		);
	}

	if (timeslots.length === 0) {
		return (
			<div
				style={{
					padding: "16px",
					background: "#fff3e0",
					borderRadius: "8px",
					color: "#e65100",
				}}
			>
				No pickup timeslots are currently available. Please check back later.
			</div>
		);
	}

	return (
		<div>
			<h3 style={{ margin: "0 0 16px", fontSize: "18px" }}>
				Select a Pickup Time
			</h3>

			{Object.entries(grouped)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([dateKey, slots]) => {
					const dateLabel = new Date(dateKey).toLocaleDateString("en-AU", {
						weekday: "long",
						day: "numeric",
						month: "long",
						year: "numeric",
					});

					return (
						<div key={dateKey} style={{ marginBottom: "16px" }}>
							<h4
								style={{
									margin: "0 0 8px",
									fontSize: "14px",
									color: "#666",
									textTransform: "uppercase",
									letterSpacing: "0.5px",
								}}
							>
								{dateLabel}
							</h4>
							<div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
								{slots.map((slot) => {
									const isSelected = selectedId === slot.id;
									return (
										<button
											key={slot.id}
											type="button"
											onClick={() => setSelectedId(slot.id)}
											style={{
												padding: "10px 16px",
												border: `2px solid ${isSelected ? "#1a1a2e" : "#e0e0e0"}`,
												borderRadius: "8px",
												background: isSelected ? "#1a1a2e" : "#fff",
												color: isSelected ? "#fff" : "#333",
												cursor: "pointer",
												fontSize: "14px",
												fontWeight: isSelected ? 600 : 400,
												transition: "all 0.15s ease",
											}}
										>
											{slot.startTime} – {slot.endTime}
										</button>
									);
								})}
							</div>
						</div>
					);
				})}

			{error && (
				<p style={{ color: "#d32f2f", fontSize: "14px", marginBottom: "12px" }}>
					{error}
				</p>
			)}

			<button
				type="button"
				onClick={handleConfirm}
				disabled={!selectedId || submitting}
				style={{
					width: "100%",
					padding: "14px",
					marginTop: "8px",
					background: !selectedId || submitting ? "#ccc" : "#1a1a2e",
					color: "#fff",
					border: "none",
					borderRadius: "8px",
					fontSize: "16px",
					fontWeight: 600,
					cursor: !selectedId || submitting ? "not-allowed" : "pointer",
				}}
			>
				{submitting ? "Confirming…" : "Confirm Pickup Time"}
			</button>
		</div>
	);
}

export default TimeslotSelector;
