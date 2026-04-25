"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import BackToDashboard from "./BackToDashboard";

// ── Types ────────────────────────────────────────────────────────────────

interface TimeslotData {
	id: string;
	date: string;
	startTime: string;
	endTime: string;
	label: string;
	isActive: boolean;
	maxCapacity: number | null;
	bookedCount: number;
	schedule?: { id: string; name: string } | string | null;
	pickupInstructionProfile?: { id: string; name: string } | string | null;
}

interface ScheduleData {
	id: string;
	name: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
	// Use local time — these are UI-created Date objects, not ISO strings
	const year = d.getFullYear();
	const month = (d.getMonth() + 1).toString().padStart(2, "0");
	const day = d.getDate().toString().padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/** Safely extract YYYY-MM-DD from a Payload date string (strips any T/timezone). */
function extractDateStr(s: string): string {
	return s.includes("T") ? s.split("T")[0] : s;
}

function addDays(d: Date, n: number): Date {
	const r = new Date(d);
	r.setDate(r.getDate() + n);
	return r;
}

function startOfWeek(d: Date): Date {
	const r = new Date(d);
	const day = r.getDay();
	// Start on Monday
	const diff = day === 0 ? -6 : 1 - day;
	r.setDate(r.getDate() + diff);
	r.setHours(0, 0, 0, 0);
	return r;
}

function formatDay(d: Date): string {
	return d.toLocaleDateString("en-NZ", {
		weekday: "short",
		day: "numeric",
		month: "short",
	});
}

function capacityColor(
	booked: number | null | undefined,
	max: number | null | undefined,
): string {
	if (max == null || max <= 0) return "#e8f5e9"; // unlimited — green
	const ratio = (booked || 0) / max;
	if (ratio >= 1) return "#ffebee"; // full — red
	if (ratio >= 0.7) return "#fff3e0"; // filling — orange
	return "#e8f5e9"; // available — green
}

function capacityText(
	booked: number | null | undefined,
	max: number | null | undefined,
): string {
	const b = booked || 0;
	if (max == null || max <= 0)
		return b > 0 ? `${b} booked · Unlimited` : "Unlimited";
	return `${b}/${max} booked`;
}

// ── Component ────────────────────────────────────────────────────────────

/**
 * Admin view: Calendar-style overview of all timeslots.
 * Shows a week view with slots grouped by date, color-coded by capacity.
 * Supports filtering by schedule and navigating between weeks.
 */
export default function ScheduleCalendarView() {
	const [timeslots, setTimeslots] = useState<TimeslotData[]>([]);
	const [schedules, setSchedules] = useState<ScheduleData[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [weekStart, setWeekStart] = useState<Date>(() =>
		startOfWeek(new Date()),
	);
	const [filterScheduleId, setFilterScheduleId] = useState<string>("all");
	const [regenerating, setRegenerating] = useState(false);
	const [regenResult, setRegenResult] = useState<string | null>(null);

	// Fetch timeslots and schedules
	const fetchData = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);

			const [tsRes, schRes] = await Promise.all([
				fetch("/api/timeslots?limit=500&depth=1", { credentials: "include" }),
				fetch("/api/schedules?limit=100", { credentials: "include" }),
			]);

			if (tsRes.ok) {
				const tsData = await tsRes.json();
				setTimeslots(tsData.docs || []);
			}
			if (schRes.ok) {
				const schData = await schRes.json();
				setSchedules(schData.docs || []);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load data");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	// Regenerate timeslots for a schedule
	const handleRegenerate = useCallback(
		async (scheduleId?: string) => {
			setRegenerating(true);
			setRegenResult(null);
			try {
				const res = await fetch("/api/admin/generate-timeslots", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "include",
					body: JSON.stringify(scheduleId ? { scheduleId } : {}),
				});
				const data = await res.json();
				if (res.ok) {
					const summaries = (data.results || [])
						.map(
							(r: {
								scheduleName: string;
								created: number;
								deactivated: number;
							}) => `${r.scheduleName}: +${r.created} / -${r.deactivated}`,
						)
						.join(", ");
					setRegenResult(`✅ ${summaries || "Done"}`);
					await fetchData();
				} else {
					setRegenResult(`❌ ${data.error || "Failed"}`);
				}
			} catch {
				setRegenResult("❌ Network error");
			} finally {
				setRegenerating(false);
			}
		},
		[fetchData],
	);

	// Build the 7-day grid
	const weekDays = useMemo(() => {
		return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
	}, [weekStart]);

	// Filter and group timeslots by date
	const slotsByDate = useMemo(() => {
		const map = new Map<string, TimeslotData[]>();
		for (const day of weekDays) {
			map.set(toDateStr(day), []);
		}
		for (const ts of timeslots) {
			const dateStr =
				typeof ts.date === "string" ? extractDateStr(ts.date) : "";

			// Filter by schedule
			if (filterScheduleId !== "all") {
				const tsScheduleId =
					typeof ts.schedule === "object" && ts.schedule
						? ts.schedule.id
						: ts.schedule;
				if (tsScheduleId !== filterScheduleId) continue;
			}

			const existing = map.get(dateStr);
			if (existing) {
				existing.push(ts);
			}
		}
		// Sort each day's slots by startTime
		for (const slots of map.values()) {
			slots.sort((a, b) =>
				(a.startTime || "").localeCompare(b.startTime || ""),
			);
		}
		return map;
	}, [timeslots, weekDays, filterScheduleId]);

	const todayStr = toDateStr(new Date());

	return (
		<div style={{ padding: "20px", maxWidth: "1200px" }}>
			<BackToDashboard />
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: "20px",
					flexWrap: "wrap",
					gap: "12px",
				}}
			>
				<h1 style={{ margin: 0, fontSize: "24px" }}>📅 Schedule Calendar</h1>
				<div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
					{/* Schedule filter */}
					<select
						value={filterScheduleId}
						onChange={(e) => setFilterScheduleId(e.target.value)}
						style={{
							padding: "6px 12px",
							borderRadius: "6px",
							border: "1px solid #ccc",
							fontSize: "13px",
						}}
					>
						<option value="all">All Schedules</option>
						{schedules.map((s) => (
							<option key={s.id} value={s.id}>
								{s.name}
							</option>
						))}
					</select>
					{/* Regenerate button */}
					<button
						type="button"
						onClick={() =>
							handleRegenerate(
								filterScheduleId !== "all" ? filterScheduleId : undefined,
							)
						}
						disabled={regenerating}
						style={{
							padding: "6px 14px",
							borderRadius: "6px",
							border: "1px solid #1565c0",
							background: regenerating ? "#ccc" : "#1565c0",
							color: "#fff",
							cursor: regenerating ? "not-allowed" : "pointer",
							fontSize: "13px",
						}}
					>
						{regenerating ? "Generating..." : "🔄 Regenerate"}
					</button>
				</div>
			</div>

			{regenResult && (
				<div
					style={{
						padding: "8px 14px",
						marginBottom: "12px",
						borderRadius: "6px",
						background: regenResult.startsWith("✅") ? "#e8f5e9" : "#ffebee",
						fontSize: "13px",
					}}
				>
					{regenResult}
				</div>
			)}

			{/* Week navigation */}
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: "16px",
				}}
			>
				<button
					type="button"
					onClick={() => setWeekStart(addDays(weekStart, -7))}
					style={navBtnStyle}
				>
					← Previous Week
				</button>
				<button
					type="button"
					onClick={() => setWeekStart(startOfWeek(new Date()))}
					style={{
						...navBtnStyle,
						fontWeight: 600,
					}}
				>
					Today
				</button>
				<button
					type="button"
					onClick={() => setWeekStart(addDays(weekStart, 7))}
					style={navBtnStyle}
				>
					Next Week →
				</button>
			</div>

			{loading ? (
				<div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
					Loading...
				</div>
			) : error ? (
				<div style={{ color: "#c62828", padding: "20px" }}>Error: {error}</div>
			) : (
				/* Calendar grid */
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(7, 1fr)",
						gap: "8px",
					}}
				>
					{weekDays.map((day) => {
						const dateStr = toDateStr(day);
						const daySlots = slotsByDate.get(dateStr) || [];
						const isToday = dateStr === todayStr;
						const isPast = dateStr < todayStr;

						return (
							<div
								key={dateStr}
								style={{
									border: isToday ? "2px solid #1565c0" : "1px solid #e0e0e0",
									borderRadius: "8px",
									minHeight: "140px",
									background: isPast ? "#fafafa" : "#fff",
									opacity: isPast ? 0.6 : 1,
								}}
							>
								{/* Day header */}
								<div
									style={{
										padding: "8px 10px",
										borderBottom: "1px solid #eee",
										fontSize: "13px",
										fontWeight: 600,
										color: isToday ? "#1565c0" : "#333",
										background: isToday ? "#e3f2fd" : "transparent",
										borderRadius: "7px 7px 0 0",
									}}
								>
									{formatDay(day)}
								</div>

								{/* Slots */}
								<div style={{ padding: "6px" }}>
									{daySlots.length === 0 ? (
										<div
											style={{
												fontSize: "12px",
												color: "#999",
												textAlign: "center",
												padding: "12px 4px",
											}}
										>
											No slots
										</div>
									) : (
										daySlots.map((slot) => {
											const bg = capacityColor(
												slot.bookedCount,
												slot.maxCapacity,
											);
											const profileName =
												typeof slot.pickupInstructionProfile === "object" &&
												slot.pickupInstructionProfile
													? slot.pickupInstructionProfile.name
													: null;

											return (
												<a
													key={slot.id}
													href={`/admin/collections/timeslots/${slot.id}`}
													style={{
														display: "block",
														padding: "6px 8px",
														marginBottom: "4px",
														borderRadius: "4px",
														background: bg,
														textDecoration: "none",
														color: "#333",
														fontSize: "12px",
														lineHeight: "1.4",
														border: slot.isActive ? "none" : "1px dashed #999",
														opacity: slot.isActive ? 1 : 0.5,
													}}
												>
													<div style={{ fontWeight: 600 }}>
														{slot.startTime} – {slot.endTime}
													</div>
													<div style={{ color: "#555" }}>
														{capacityText(slot.bookedCount, slot.maxCapacity)}
													</div>
													{profileName && (
														<div
															style={{
																color: "#1565c0",
																fontSize: "11px",
															}}
														>
															📍 {profileName}
														</div>
													)}
													{!slot.isActive && (
														<div
															style={{
																color: "#999",
																fontSize: "11px",
																fontStyle: "italic",
															}}
														>
															Inactive
														</div>
													)}
												</a>
											);
										})
									)}
								</div>
							</div>
						);
					})}
				</div>
			)}

			{/* Legend */}
			<div
				style={{
					display: "flex",
					gap: "16px",
					marginTop: "16px",
					fontSize: "12px",
					color: "#666",
				}}
			>
				<span>
					<span style={{ ...legendDot, background: "#e8f5e9" }} /> Available
				</span>
				<span>
					<span style={{ ...legendDot, background: "#fff3e0" }} /> Filling up
				</span>
				<span>
					<span style={{ ...legendDot, background: "#ffebee" }} /> Full
				</span>
				<span>
					<span
						style={{
							...legendDot,
							background: "#f5f5f5",
							border: "1px dashed #999",
						}}
					/>{" "}
					Inactive
				</span>
			</div>
		</div>
	);
}

// ── Styles ───────────────────────────────────────────────────────────────

const navBtnStyle: React.CSSProperties = {
	padding: "6px 16px",
	borderRadius: "6px",
	border: "1px solid #ddd",
	background: "#fff",
	cursor: "pointer",
	fontSize: "13px",
};

const legendDot: React.CSSProperties = {
	display: "inline-block",
	width: "12px",
	height: "12px",
	borderRadius: "3px",
	marginRight: "4px",
	verticalAlign: "middle",
};
