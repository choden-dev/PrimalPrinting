"use client";

import { useCallback, useEffect, useState } from "react";
import { OrderStatus } from "../../types/orderStatus";

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
	pricing: { total: number };
	files: { fileName: string; copies: number }[];
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
			// Fetch timeslots
			const timeslotRes = await fetch(
				`/api/timeslots?limit=100&sort=date&depth=0`,
			);
			if (!timeslotRes.ok) throw new Error("Failed to fetch timeslots.");
			const timeslotData = await timeslotRes.json();
			const timeslots: TimeslotData[] = timeslotData.docs || [];

			// For each timeslot, fetch orders assigned to it
			const results: TimeslotWithOrders[] = [];

			for (const slot of timeslots) {
				// Filter: only upcoming if selected
				if (filter === "upcoming") {
					const slotDate = new Date(slot.date);
					const today = new Date();
					today.setHours(0, 0, 0, 0);
					if (slotDate < today) continue;
				}

				const orderRes = await fetch(
					`/api/orders?where[pickupTimeslot][equals]=${slot.id}&depth=1&limit=50&sort=-createdAt`,
				);
				if (!orderRes.ok) continue;
				const orderData = await orderRes.json();

				if (orderData.docs && orderData.docs.length > 0) {
					results.push({
						timeslot: slot,
						orders: orderData.docs,
					});
				}
			}

			// Also add a "No timeslot" group for paid orders without a slot
			const unassignedRes = await fetch(
				`/api/orders?where[status][in]=PAID&where[pickupTimeslot][exists]=false&depth=1&limit=50`,
			);
			if (unassignedRes.ok) {
				const unassignedData = await unassignedRes.json();
				if (unassignedData.docs && unassignedData.docs.length > 0) {
					results.unshift({
						timeslot: {
							id: "unassigned",
							date: "",
							startTime: "",
							endTime: "",
							label: "⚠️ Paid — No Pickup Time Selected",
						},
						orders: unassignedData.docs,
					});
				}
			}

			setData(results);
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

	return (
		<div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: "24px",
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
				const dateLabel = timeslot.date
					? new Date(timeslot.date).toLocaleDateString("en-AU", {
							weekday: "long",
							day: "numeric",
							month: "long",
							year: "numeric",
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
												{order.files?.map((f, i) => (
													<div
														key={`${f.fileName}-${i}`}
														style={{ fontSize: "12px" }}
													>
														{f.fileName} ×{f.copies}
													</div>
												))}
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
																	"en-AU",
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
