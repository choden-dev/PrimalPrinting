"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OrderStatusValue } from "../../types/orderStatus";
import { OrderStatus, PAID_STATUSES } from "../../types/orderStatus";
import BackToDashboard from "./BackToDashboard";

interface TimeslotData {
	id: string;
	date: string;
	startTime: string;
	endTime: string;
	label: string;
}

interface OrderData {
	id: string;
	orderNumber: string;
	status: string;
	paymentMethod: string | null;
	bankTransferVerified: boolean | null;
	pricing: { total: number };
	files: {
		fileName: string;
		copies: number;
		colorMode?: string;
		stagingKey?: string;
		permanentKey?: string;
	}[];
	customer: { name: string; email: string } | string;
	pickedUpAt: string | null;
}

interface TimeslotWithOrders {
	timeslot: TimeslotData;
	orders: OrderData[];
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
	[OrderStatus.PAID]: { bg: "#e8f5e9", text: "#2e7d32" },
	[OrderStatus.AWAITING_PICKUP]: { bg: "#e3f2fd", text: "#1565c0" },
	[OrderStatus.PRINTED]: { bg: "#e8eaf6", text: "#283593" },
	[OrderStatus.PICKED_UP]: { bg: "#f3e5f5", text: "#6a1b9a" },
};

/**
 * Custom Payload admin view: Orders grouped by pickup timeslot.
 *
 * This is the view the admin uses in-person to manage pickups —
 * see which orders are coming for each timeslot and mark them as picked up.
 */
export default function OrdersByTimeslotView() {
	const [data, setData] = useState<TimeslotWithOrders[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [filter, setFilter] = useState<"upcoming" | "all">("upcoming");

	const fetchData = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			// Single API call replaces N+2 sequential requests
			const res = await fetch(`/api/admin/orders-by-timeslot?filter=${filter}`);
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.error || "Failed to fetch orders by timeslot.");
			}
			const json = await res.json();
			setData(json.groups || []);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load data.");
		} finally {
			setLoading(false);
		}
	}, [filter]);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	const handleMarkPickedUp = useCallback(
		async (orderId: string) => {
			if (!window.confirm("Mark this order as picked up?")) return;

			try {
				const res = await fetch(`/api/shop/${orderId}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ status: OrderStatus.PICKED_UP }),
				});
				if (!res.ok) {
					const err = await res.json();
					throw new Error(err.error || "Failed to update.");
				}
				fetchData(); // Refresh
			} catch (err) {
				window.alert(
					err instanceof Error ? err.message : "Failed to update order.",
				);
			}
		},
		[fetchData],
	);

	const handleMarkReady = useCallback(
		async (orderId: string) => {
			try {
				const res = await fetch(`/api/shop/${orderId}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ status: OrderStatus.PRINTED }),
				});
				if (!res.ok) {
					const err = await res.json();
					throw new Error(err.error || "Failed to update.");
				}
				fetchData();
			} catch (err) {
				window.alert(
					err instanceof Error ? err.message : "Failed to update order.",
				);
			}
		},
		[fetchData],
	);

	const getCustomerDisplay = (
		customer: OrderData["customer"],
	): { name: string; email: string } => {
		if (typeof customer === "object" && customer !== null) {
			return { name: customer.name || "—", email: customer.email || "—" };
		}
		return { name: "—", email: "—" };
	};

	/** Resolve the correct R2 key for a file based on order payment status */
	const getFileKey = useCallback(
		(
			file: OrderData["files"][number],
			orderStatus: string,
		): { key: string; staging: boolean } | null => {
			const isPaid = PAID_STATUSES.includes(orderStatus as OrderStatusValue);
			if (isPaid && file.permanentKey) {
				return { key: file.permanentKey, staging: false };
			}
			if (file.stagingKey) {
				return { key: file.stagingKey, staging: true };
			}
			return null;
		},
		[],
	);

	/** Fetch a presigned URL and open it in a new tab */
	const handleDownloadFile = useCallback(
		async (file: OrderData["files"][number], orderStatus: string) => {
			const resolved = getFileKey(file, orderStatus);
			if (!resolved) return;

			try {
				const params = new URLSearchParams({
					key: resolved.key,
					staging: resolved.staging.toString(),
				});
				const res = await fetch(`/api/admin/file-url?${params}`);
				if (!res.ok) throw new Error("Failed to get file URL");
				const { url } = await res.json();
				window.open(url, "_blank");
			} catch {
				window.alert(`Failed to open file: ${file.fileName}`);
			}
		},
		[getFileKey],
	);

	/** Download all files for all orders in a timeslot group sequentially */
	const downloadingRef = useRef(false);
	const handleDownloadAllFiles = useCallback(
		async (orders: OrderData[]) => {
			if (downloadingRef.current) return;
			downloadingRef.current = true;

			try {
				// Collect all files with their resolved keys
				const filesToDownload: {
					key: string;
					staging: boolean;
					fileName: string;
				}[] = [];
				for (const order of orders) {
					for (const file of order.files || []) {
						const resolved = getFileKey(file, order.status);
						if (resolved) {
							filesToDownload.push({ ...resolved, fileName: file.fileName });
						}
					}
				}

				if (filesToDownload.length === 0) {
					window.alert("No downloadable files found.");
					return;
				}

				// Fetch all presigned URLs in parallel
				const urlResults = await Promise.all(
					filesToDownload.map(async ({ key, staging, fileName }) => {
						try {
							const params = new URLSearchParams({
								key,
								staging: staging.toString(),
							});
							const res = await fetch(`/api/admin/file-url?${params}`);
							if (!res.ok) return null;
							const { url } = await res.json();
							return { url, fileName };
						} catch {
							return null;
						}
					}),
				);

				// Open each file in a new tab with a small delay to avoid popup blockers
				const validUrls = urlResults.filter(Boolean) as {
					url: string;
					fileName: string;
				}[];
				for (let i = 0; i < validUrls.length; i++) {
					window.open(validUrls[i].url, "_blank");
					if (i < validUrls.length - 1) {
						await new Promise((r) => setTimeout(r, 300));
					}
				}

				if (validUrls.length < filesToDownload.length) {
					window.alert(
						`Opened ${validUrls.length} of ${filesToDownload.length} files. Some files could not be loaded.`,
					);
				}
			} finally {
				downloadingRef.current = false;
			}
		},
		[getFileKey],
	);

	return (
		<div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
			<BackToDashboard />
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: "24px",
					marginTop: "8px",
					flexWrap: "wrap",
					gap: "12px",
				}}
			>
				<h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700 }}>
					📦 Orders by Pickup Timeslot
				</h1>
				<div style={{ display: "flex", gap: "8px" }}>
					<button
						type="button"
						onClick={() => setFilter("upcoming")}
						style={{
							padding: "8px 16px",
							borderRadius: "6px",
							border: "1px solid #ccc",
							background: filter === "upcoming" ? "#1a1a2e" : "#fff",
							color: filter === "upcoming" ? "#fff" : "#333",
							cursor: "pointer",
							fontWeight: 600,
							fontSize: "13px",
						}}
					>
						Upcoming
					</button>
					<button
						type="button"
						onClick={() => setFilter("all")}
						style={{
							padding: "8px 16px",
							borderRadius: "6px",
							border: "1px solid #ccc",
							background: filter === "all" ? "#1a1a2e" : "#fff",
							color: filter === "all" ? "#fff" : "#333",
							cursor: "pointer",
							fontWeight: 600,
							fontSize: "13px",
						}}
					>
						All Time
					</button>
					<button
						type="button"
						onClick={fetchData}
						style={{
							padding: "8px 16px",
							borderRadius: "6px",
							border: "1px solid #ccc",
							background: "#fff",
							cursor: "pointer",
							fontSize: "13px",
						}}
					>
						🔄 Refresh
					</button>
				</div>
			</div>

			{loading && (
				<div style={{ textAlign: "center", padding: "48px", color: "#666" }}>
					Loading orders…
				</div>
			)}

			{error && (
				<div
					style={{
						padding: "16px",
						background: "#ffebee",
						borderRadius: "8px",
						color: "#c62828",
						marginBottom: "16px",
					}}
				>
					{error}
				</div>
			)}

			{!loading && data.length === 0 && (
				<div
					style={{
						textAlign: "center",
						padding: "48px",
						color: "#666",
						background: "#f5f5f5",
						borderRadius: "8px",
					}}
				>
					No orders found for {filter === "upcoming" ? "upcoming" : "any"}{" "}
					timeslots.
				</div>
			)}

			{data.map(({ timeslot, orders }) => {
				// Parse date safely — use noon UTC to avoid timezone shift
				const dateStr = timeslot.date
					? timeslot.date.includes("T")
						? timeslot.date.split("T")[0]
						: timeslot.date
					: "";
				const dateLabel = dateStr
					? new Date(`${dateStr}T12:00:00Z`).toLocaleDateString("en-NZ", {
							weekday: "long",
							day: "numeric",
							month: "long",
							year: "numeric",
							timeZone: "UTC",
						})
					: "";

				return (
					<div
						key={timeslot.id}
						style={{
							marginBottom: "24px",
							border: "1px solid #e0e0e0",
							borderRadius: "8px",
							overflow: "hidden",
						}}
					>
						{/* Timeslot header */}
						<div
							style={{
								padding: "12px 16px",
								background: "#1a1a2e",
								color: "#fff",
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
								flexWrap: "wrap",
								gap: "8px",
							}}
						>
							<div>
								<strong>
									{timeslot.label ||
										`${dateLabel} ${timeslot.startTime} – ${timeslot.endTime}`}
								</strong>
								{dateLabel && (
									<span
										style={{
											marginLeft: "12px",
											opacity: 0.7,
											fontSize: "13px",
										}}
									>
										{dateLabel} · {timeslot.startTime} – {timeslot.endTime}
									</span>
								)}
							</div>
							<div
								style={{
									display: "flex",
									alignItems: "center",
									gap: "8px",
								}}
							>
								<span
									style={{
										background: "rgba(255,255,255,0.2)",
										padding: "2px 10px",
										borderRadius: "12px",
										fontSize: "12px",
									}}
								>
									{orders.length} order{orders.length !== 1 ? "s" : ""}
								</span>
								<button
									type="button"
									onClick={() => handleDownloadAllFiles(orders)}
									style={{
										padding: "3px 10px",
										fontSize: "12px",
										fontWeight: 600,
										background: "rgba(255,255,255,0.15)",
										color: "#fff",
										border: "1px solid rgba(255,255,255,0.3)",
										borderRadius: "4px",
										cursor: "pointer",
									}}
								>
									⬇ Download All Files
								</button>
							</div>
						</div>

						{/* Orders table */}
						<table
							style={{
								width: "100%",
								borderCollapse: "collapse",
								fontSize: "14px",
							}}
						>
							<thead>
								<tr style={{ background: "#f5f5f5" }}>
									<th
										style={{
											padding: "8px 12px",
											textAlign: "left",
											fontWeight: 600,
										}}
									>
										Order #
									</th>
									<th
										style={{
											padding: "8px 12px",
											textAlign: "left",
											fontWeight: 600,
										}}
									>
										Customer
									</th>
									<th
										style={{
											padding: "8px 12px",
											textAlign: "left",
											fontWeight: 600,
										}}
									>
										Files
									</th>
									<th
										style={{
											padding: "8px 12px",
											textAlign: "right",
											fontWeight: 600,
										}}
									>
										Total
									</th>
									<th
										style={{
											padding: "8px 12px",
											textAlign: "center",
											fontWeight: 600,
										}}
									>
										Status
									</th>
									<th
										style={{
											padding: "8px 12px",
											textAlign: "right",
											fontWeight: 600,
										}}
									>
										Actions
									</th>
								</tr>
							</thead>
							<tbody>
								{orders.map((order) => {
									const cust = getCustomerDisplay(order.customer);
									const statusStyle = STATUS_COLORS[order.status] || {
										bg: "#f5f5f5",
										text: "#666",
									};
									return (
										<tr key={order.id} style={{ borderTop: "1px solid #eee" }}>
											<td
												style={{
													padding: "10px 12px",
													fontFamily: "monospace",
													fontWeight: 600,
												}}
											>
												<a
													href={`/admin/collections/orders/${order.id}`}
													style={{ color: "#1565c0", textDecoration: "none" }}
												>
													{order.orderNumber}
												</a>
											</td>
											<td style={{ padding: "10px 12px" }}>
												<div>{cust.name}</div>
												<div style={{ fontSize: "12px", color: "#999" }}>
													{cust.email}
												</div>
											</td>
											<td style={{ padding: "10px 12px" }}>
												{order.files?.map((f) => {
													const hasKey = !!(f.stagingKey || f.permanentKey);
													return (
														<div
															key={`${f.fileName}-${f.copies}-${f.colorMode}`}
															style={{
																fontSize: "12px",
																display: "flex",
																alignItems: "center",
																gap: "6px",
																marginBottom: "2px",
															}}
														>
															<span>
																{f.fileName} ×{f.copies}
															</span>
															{hasKey && (
																<button
																	type="button"
																	title={`Download ${f.fileName}`}
																	onClick={() =>
																		handleDownloadFile(f, order.status)
																	}
																	style={{
																		padding: "1px 6px",
																		fontSize: "11px",
																		background: "#e3f2fd",
																		color: "#1565c0",
																		border: "1px solid #90caf9",
																		borderRadius: "3px",
																		cursor: "pointer",
																		whiteSpace: "nowrap",
																		flexShrink: 0,
																	}}
																>
																	⬇ Open
																</button>
															)}
														</div>
													);
												})}
											</td>
											<td
												style={{
													padding: "10px 12px",
													textAlign: "right",
													fontWeight: 600,
												}}
											>
												${((order.pricing?.total || 0) / 100).toFixed(2)}
											</td>
											<td style={{ padding: "10px 12px", textAlign: "center" }}>
												<span
													style={{
														display: "inline-block",
														padding: "3px 10px",
														borderRadius: "12px",
														fontSize: "11px",
														fontWeight: 600,
														background: statusStyle.bg,
														color: statusStyle.text,
													}}
												>
													{order.status.replace(/_/g, " ")}
												</span>
												{order.paymentMethod === "BANK_TRANSFER" && (
													<span
														style={{
															display: "inline-block",
															padding: "3px 8px",
															borderRadius: "12px",
															fontSize: "10px",
															fontWeight: 600,
															marginLeft: "4px",
															background: order.bankTransferVerified
																? "#e8f5e9"
																: "#fff3e0",
															color: order.bankTransferVerified
																? "#2e7d32"
																: "#e65100",
														}}
													>
														{order.bankTransferVerified
															? "✓ Verified"
															: "⏳ Unverified"}
													</span>
												)}
											</td>
											<td style={{ padding: "10px 12px", textAlign: "right" }}>
												{order.status === OrderStatus.AWAITING_PICKUP && (
													<button
														type="button"
														onClick={() => handleMarkReady(order.id)}
														style={{
															padding: "4px 12px",
															background: "#283593",
															color: "#fff",
															border: "none",
															borderRadius: "4px",
															fontSize: "12px",
															fontWeight: 600,
															cursor: "pointer",
															marginRight: "4px",
														}}
													>
														Mark Printed
													</button>
												)}
												{order.status === OrderStatus.PRINTED && (
													<button
														type="button"
														onClick={() => handleMarkPickedUp(order.id)}
														style={{
															padding: "4px 12px",
															background: "#6a1b9a",
															color: "#fff",
															border: "none",
															borderRadius: "4px",
															fontSize: "12px",
															fontWeight: 600,
															cursor: "pointer",
														}}
													>
														Mark Picked Up
													</button>
												)}
												{order.status === OrderStatus.PICKED_UP && (
													<span style={{ fontSize: "12px", color: "#999" }}>
														✓{" "}
														{order.pickedUpAt
															? new Date(order.pickedUpAt).toLocaleDateString(
																	"en-NZ",
																)
															: "Done"}
													</span>
												)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				);
			})}
		</div>
	);
}
