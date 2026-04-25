"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface PickupProfileInfo {
	id: string;
	name: string;
	shortSummary: string | null;
}

interface Timeslot {
	id: string;
	date: string;
	startTime: string;
	endTime: string;
	label: string;
	maxCapacity: number | null;
	bookedCount: number;
	availableSpots: number | null;
	pickupInstructionProfile: PickupProfileInfo | null;
}

interface TimeslotSelectorProps {
	orderId: string;
	onTimeslotSelected: (
		timeslotId: string,
		pickupInstructions?: unknown[],
	) => void;
	onCancel: () => void;
}

/** Number of date-groups to show per page. */
const DATES_PER_PAGE = 3;

/** Group timeslots by date for display. */
function groupByDate(slots: Timeslot[]): Map<string, Timeslot[]> {
	const map = new Map<string, Timeslot[]>();
	for (const slot of slots) {
		const dateKey =
			typeof slot.date === "string" ? slot.date.split("T")[0] : "";
		const existing = map.get(dateKey);
		if (existing) {
			existing.push(slot);
		} else {
			map.set(dateKey, [slot]);
		}
	}
	return map;
}

/** Format a date string into a user-friendly label. */
function formatDateHeading(dateStr: string): string {
	try {
		return new Date(dateStr).toLocaleDateString("en-NZ", {
			weekday: "long",
			day: "numeric",
			month: "long",
			year: "numeric",
		});
	} catch {
		return dateStr;
	}
}

/**
 * Component to select a pickup timeslot for an order.
 * Fetches available timeslots and displays them grouped by date
 * with pagination so the list doesn't get cut off.
 * Shows capacity info and pickup instruction profile names.
 */
export function TimeslotSelector({
	orderId,
	onTimeslotSelected,
	onCancel,
}: TimeslotSelectorProps) {
	const [timeslots, setTimeslots] = useState<Timeslot[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [page, setPage] = useState(0);

	// Fetch available timeslots
	useEffect(() => {
		const fetchTimeslots = async () => {
			try {
				setLoading(true);
				setError(null);
				const res = await fetch("/api/pickup-slots");
				if (!res.ok) {
					throw new Error("Failed to load timeslots");
				}
				const data = await res.json();
				setTimeslots(data.timeslots || []);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Unknown error");
			} finally {
				setLoading(false);
			}
		};

		fetchTimeslots();
	}, []);

	// Group timeslots by date and paginate by date-groups
	const grouped = useMemo(() => groupByDate(timeslots), [timeslots]);
	const dateKeys = useMemo(() => Array.from(grouped.keys()), [grouped]);
	const totalPages = Math.max(1, Math.ceil(dateKeys.length / DATES_PER_PAGE));

	const visibleDateKeys = useMemo(() => {
		const start = page * DATES_PER_PAGE;
		return dateKeys.slice(start, start + DATES_PER_PAGE);
	}, [dateKeys, page]);

	// Handle timeslot selection submission
	const handleSubmit = useCallback(async () => {
		if (!selectedId) return;

		try {
			setSubmitting(true);
			setError(null);
			const res = await fetch(`/api/shop/${orderId}/select-timeslot`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ timeslotId: selectedId }),
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || "Failed to select timeslot");
			}

			const data = await res.json();
			onTimeslotSelected(
				selectedId,
				data.pickupInstructionProfile?.instructions,
			);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error");
		} finally {
			setSubmitting(false);
		}
	}, [selectedId, orderId, onTimeslotSelected]);

	if (loading) {
		return (
			<div style={{ padding: "20px", textAlign: "center" }}>
				Loading timeslots...
			</div>
		);
	}

	if (error) {
		return (
			<div style={{ padding: "20px" }}>
				<div style={{ color: "#c62828", marginBottom: "12px" }}>
					Error: {error}
				</div>
				<button type="button" onClick={onCancel} style={cancelButtonStyle}>
					Back
				</button>
			</div>
		);
	}

	if (timeslots.length === 0) {
		return (
			<div style={{ padding: "20px" }}>
				<p style={{ marginBottom: "12px" }}>
					No timeslots available at the moment.
				</p>
				<p style={{ fontSize: "14px", color: "#666" }}>
					We&apos;ll notify you by email when pickup slots become available.
				</p>
				<button type="button" onClick={onCancel} style={cancelButtonStyle}>
					Back
				</button>
			</div>
		);
	}

	return (
		<div style={{ padding: "8px 0" }}>
			<h2 style={{ marginBottom: "16px" }}>Select a Pickup Timeslot</h2>

			{visibleDateKeys.map((dateKey) => {
				const slots = grouped.get(dateKey) || [];
				return (
					<div key={dateKey} style={{ marginBottom: "20px" }}>
						<h3
							style={{
								fontSize: "15px",
								fontWeight: 600,
								color: "#333",
								marginBottom: "8px",
								borderBottom: "1px solid #eee",
								paddingBottom: "4px",
							}}
						>
							{formatDateHeading(dateKey)}
						</h3>
						<div
							style={{ display: "flex", flexDirection: "column", gap: "8px" }}
						>
							{slots.map((slot) => {
								const isSelected = selectedId === slot.id;
								return (
									<label
										key={slot.id}
										style={{
											padding: "12px 16px",
											border: isSelected
												? "2px solid #1565c0"
												: "1px solid #ddd",
											borderRadius: "8px",
											cursor: "pointer",
											backgroundColor: isSelected ? "#e3f2fd" : "#fff",
											transition: "all 0.15s ease",
										}}
									>
										<div
											style={{
												display: "flex",
												alignItems: "center",
												gap: "10px",
											}}
										>
											<input
												type="radio"
												name="timeslot"
												value={slot.id}
												checked={isSelected}
												onChange={() => setSelectedId(slot.id)}
												style={{ marginRight: "4px" }}
											/>
											<div style={{ flex: 1 }}>
												<div style={{ fontWeight: 600 }}>
													{slot.startTime} – {slot.endTime}
													{slot.label ? ` · ${slot.label}` : ""}
												</div>
												<div
													style={{
														display: "flex",
														gap: "12px",
														fontSize: "13px",
														color: "#666",
														marginTop: "4px",
													}}
												>
													{/* Capacity indicator */}
													<span>
														{slot.availableSpots !== null ? (
															<>
																<span
																	style={{
																		color:
																			slot.availableSpots <= 2
																				? "#e65100"
																				: "#2e7d32",
																		fontWeight: 500,
																	}}
																>
																	{slot.availableSpots}
																</span>{" "}
																spot{slot.availableSpots !== 1 ? "s" : ""}{" "}
																remaining
															</>
														) : (
															"Open availability"
														)}
													</span>

													{/* Pickup method */}
													{slot.pickupInstructionProfile && (
														<span style={{ color: "#1565c0" }}>
															📍 {slot.pickupInstructionProfile.name}
														</span>
													)}
												</div>
											</div>
										</div>
									</label>
								);
							})}
						</div>
					</div>
				);
			})}

			{/* Pagination controls */}
			{totalPages > 1 && (
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						gap: "12px",
						marginBottom: "16px",
					}}
				>
					<button
						type="button"
						onClick={() => setPage((p) => Math.max(0, p - 1))}
						disabled={page === 0}
						style={{
							...paginationButtonStyle,
							opacity: page === 0 ? 0.4 : 1,
							cursor: page === 0 ? "not-allowed" : "pointer",
						}}
					>
						← Previous
					</button>
					<span style={{ fontSize: "14px", color: "#666" }}>
						Page {page + 1} of {totalPages}
					</span>
					<button
						type="button"
						onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
						disabled={page >= totalPages - 1}
						style={{
							...paginationButtonStyle,
							opacity: page >= totalPages - 1 ? 0.4 : 1,
							cursor: page >= totalPages - 1 ? "not-allowed" : "pointer",
						}}
					>
						Next →
					</button>
				</div>
			)}

			<div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
				<button
					type="button"
					onClick={handleSubmit}
					disabled={!selectedId || submitting}
					style={{
						padding: "10px 24px",
						background: !selectedId || submitting ? "#ccc" : "#1565c0",
						color: "#fff",
						border: "none",
						borderRadius: "6px",
						cursor: !selectedId || submitting ? "not-allowed" : "pointer",
						fontWeight: 600,
						fontSize: "14px",
					}}
				>
					{submitting ? "Confirming..." : "Confirm Timeslot"}
				</button>
				<button type="button" onClick={onCancel} style={cancelButtonStyle}>
					Cancel
				</button>
			</div>
		</div>
	);
}

const cancelButtonStyle: React.CSSProperties = {
	padding: "10px 24px",
	background: "#f5f5f5",
	border: "1px solid #ddd",
	borderRadius: "6px",
	cursor: "pointer",
	fontSize: "14px",
};

const paginationButtonStyle: React.CSSProperties = {
	padding: "8px 16px",
	background: "#f5f5f5",
	border: "1px solid #ddd",
	borderRadius: "6px",
	fontSize: "14px",
	fontWeight: 500,
};

export default TimeslotSelector;
