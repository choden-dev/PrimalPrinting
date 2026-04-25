"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

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

interface TimeslotResponse {
	success: boolean;
	timeslots: Timeslot[];
	total: number;
	limit: number;
	offset: number;
	hasMore: boolean;
}

interface TimeslotSelectorProps {
	orderId: string;
	onTimeslotSelected: (
		timeslotId: string,
		pickupInstructions?: unknown[],
	) => void;
	onCancel: () => void;
}

/** Number of timeslots to fetch per page. */
const PAGE_SIZE = 15;

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

/** Fetch a page of pickup timeslots from the API. */
async function fetchTimeslots(page: number): Promise<TimeslotResponse> {
	const offset = page * PAGE_SIZE;
	const res = await fetch(
		`/api/pickup-slots?limit=${PAGE_SIZE}&offset=${offset}`,
	);
	if (!res.ok) {
		throw new Error("Failed to load timeslots");
	}
	return res.json();
}

/**
 * Component to select a pickup timeslot for an order.
 * Fetches available timeslots using React Query with server-side
 * pagination. Displays them grouped by date with Previous/Next controls.
 * Shows capacity info and pickup instruction profile names.
 */
export function TimeslotSelector({
	orderId,
	onTimeslotSelected,
	onCancel,
}: TimeslotSelectorProps) {
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [page, setPage] = useState(0);

	const { data, isLoading, isError, error, isPlaceholderData } = useQuery({
		queryKey: ["pickup-slots", page],
		queryFn: () => fetchTimeslots(page),
		placeholderData: (prev) => prev,
	});

	const timeslots = data?.timeslots ?? [];
	const total = data?.total ?? 0;
	const hasMore = data?.hasMore ?? false;
	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

	// Group the current page's timeslots by date
	const grouped = useMemo(() => groupByDate(timeslots), [timeslots]);

	// Handle timeslot selection submission
	const handleSubmit = useCallback(async () => {
		if (!selectedId) return;

		try {
			setSubmitting(true);
			setSubmitError(null);
			const res = await fetch(`/api/shop/${orderId}/select-timeslot`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ timeslotId: selectedId }),
			});

			if (!res.ok) {
				const errData = await res.json();
				throw new Error(errData.error || "Failed to select timeslot");
			}

			const resData = await res.json();
			onTimeslotSelected(
				selectedId,
				resData.pickupInstructionProfile?.instructions,
			);
		} catch (err) {
			setSubmitError(err instanceof Error ? err.message : "Unknown error");
		} finally {
			setSubmitting(false);
		}
	}, [selectedId, orderId, onTimeslotSelected]);

	if (isLoading) {
		return (
			<div style={{ padding: "20px", textAlign: "center" }}>
				Loading timeslots...
			</div>
		);
	}

	if (isError) {
		return (
			<div style={{ padding: "20px" }}>
				<div style={{ color: "#c62828", marginBottom: "12px" }}>
					Error: {error instanceof Error ? error.message : "Unknown error"}
				</div>
				<button type="button" onClick={onCancel} style={cancelButtonStyle}>
					Back
				</button>
			</div>
		);
	}

	if (total === 0) {
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
		<div
			style={{
				padding: "8px 0",
				opacity: isPlaceholderData ? 0.6 : 1,
				transition: "opacity 0.15s ease",
			}}
		>
			<h2 style={{ marginBottom: "16px" }}>Select a Pickup Timeslot</h2>

			{submitError && (
				<div
					style={{ color: "#c62828", marginBottom: "12px", fontSize: "14px" }}
				>
					Error: {submitError}
				</div>
			)}

			{Array.from(grouped.entries()).map(([dateKey, slots]) => (
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
					<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
						{slots.map((slot) => {
							const isSelected = selectedId === slot.id;
							return (
								<label
									key={slot.id}
									style={{
										padding: "12px 16px",
										border: isSelected ? "2px solid #1565c0" : "1px solid #ddd",
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
			))}

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
						onClick={() => setPage((p) => p + 1)}
						disabled={!hasMore}
						style={{
							...paginationButtonStyle,
							opacity: !hasMore ? 0.4 : 1,
							cursor: !hasMore ? "not-allowed" : "pointer",
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
