"use client";

import { useCallback, useEffect, useState } from "react";

interface OrderData {
	id: string;
	orderNumber: string;
	customer: {
		id: string;
		email: string;
		name?: string;
	};
	status: string;
	createdAt: string;
}

interface NotifyResult {
	success: boolean;
	message: string;
	notified: number;
	failed: number;
	details?: { email: string; success: boolean; error?: string }[];
}

/**
 * Admin view to notify customers whose PAID orders don't have a timeslot
 * selected yet. Shows a preview of who will be emailed and a button to
 * trigger the bulk notification.
 */
export default function NotifyTimeslotsView() {
	const [orders, setOrders] = useState<OrderData[]>([]);
	const [loading, setLoading] = useState(true);
	const [sending, setSending] = useState(false);
	const [result, setResult] = useState<NotifyResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [hasActiveTimeslots, setHasActiveTimeslots] = useState(false);

	const fetchData = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			// Fetch PAID orders without timeslots
			const ordersRes = await fetch(
				"/api/orders?" +
					new URLSearchParams({
						where: JSON.stringify({
							and: [
								{ status: { equals: "PAID" } },
								{
									or: [
										{ pickupTimeslot: { exists: false } },
										{ pickupTimeslot: { equals: null } },
									],
								},
							],
						}),
						limit: "500",
						depth: "1",
					}),
			);

			if (ordersRes.ok) {
				const data = await ordersRes.json();
				setOrders(data.docs || []);
			}

			// Check for active timeslots
			const timeslotsRes = await fetch(
				"/api/timeslots?" +
					new URLSearchParams({
						where: JSON.stringify({
							isActive: { equals: true },
						}),
						limit: "1",
					}),
			);

			if (timeslotsRes.ok) {
				const data = await timeslotsRes.json();
				setHasActiveTimeslots((data.totalDocs || 0) > 0);
			}
		} catch (err) {
			setError("Failed to load data.");
			console.error(err);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	const handleNotify = useCallback(async () => {
		if (
			!confirm(
				`Are you sure you want to send notification emails to customers with ${orders.length} order(s) waiting for timeslots?`,
			)
		) {
			return;
		}

		setSending(true);
		setResult(null);
		setError(null);

		try {
			const res = await fetch("/api/admin/notify-timeslots", {
				method: "POST",
			});
			const data = await res.json();

			if (!res.ok) {
				setError(data.error || "Failed to send notifications.");
				return;
			}

			setResult(data);
			// Refresh the list
			await fetchData();
		} catch (err) {
			setError("Failed to send notifications.");
			console.error(err);
		} finally {
			setSending(false);
		}
	}, [orders.length, fetchData]);

	// Group orders by customer email for display
	const customerGroups = new Map<
		string,
		{ name: string; email: string; orders: OrderData[] }
	>();
	for (const order of orders) {
		const customer = typeof order.customer === "object" ? order.customer : null;
		if (!customer?.email) continue;
		const existing = customerGroups.get(customer.email);
		if (existing) {
			existing.orders.push(order);
		} else {
			customerGroups.set(customer.email, {
				name: customer.name || "Unknown",
				email: customer.email,
				orders: [order],
			});
		}
	}

	return (
		<div
			style={{
				maxWidth: 900,
				margin: "0 auto",
				padding: "40px 24px",
			}}
		>
			<div style={{ marginBottom: 24 }}>
				<h1
					style={{
						fontSize: 24,
						fontWeight: 700,
						margin: 0,
						display: "flex",
						alignItems: "center",
						gap: 8,
					}}
				>
					📧 Notify Customers — Timeslots Available
				</h1>
				<p
					style={{
						fontSize: 14,
						color: "#666",
						marginTop: 8,
					}}
				>
					Send an email to all customers with paid orders who haven&apos;t
					selected a pickup timeslot yet, letting them know timeslots are now
					available.
				</p>
			</div>

			{/* Status Banner */}
			{!hasActiveTimeslots && !loading && (
				<div
					style={{
						background: "#fff3e0",
						border: "1px solid #ff9800",
						borderRadius: 8,
						padding: 16,
						marginBottom: 24,
						display: "flex",
						alignItems: "center",
						gap: 12,
					}}
				>
					<span style={{ fontSize: 24 }}>⚠️</span>
					<div>
						<strong style={{ color: "#e65100" }}>No Active Timeslots</strong>
						<p
							style={{
								margin: "4px 0 0",
								fontSize: 14,
								color: "#666",
							}}
						>
							Create timeslots first before notifying customers. Go to{" "}
							<a href="/admin/collections/timeslots">Timeslots</a> to add pickup
							slots.
						</p>
					</div>
				</div>
			)}

			{/* Success Result */}
			{result && (
				<div
					style={{
						background: "#e8f5e9",
						border: "1px solid #4caf50",
						borderRadius: 8,
						padding: 16,
						marginBottom: 24,
					}}
				>
					<strong style={{ color: "#2e7d32" }}>✅ {result.message}</strong>
					{result.details?.some((d) => !d.success) && (
						<div style={{ marginTop: 8, fontSize: 13, color: "#c62828" }}>
							<strong>Failed:</strong>
							<ul style={{ margin: "4px 0", paddingLeft: 20 }}>
								{result.details
									.filter((d) => !d.success)
									.map((d) => (
										<li key={d.email}>
											{d.email}: {d.error}
										</li>
									))}
							</ul>
						</div>
					)}
				</div>
			)}

			{/* Error */}
			{error && (
				<div
					style={{
						background: "#ffebee",
						border: "1px solid #ef5350",
						borderRadius: 8,
						padding: 16,
						marginBottom: 24,
						color: "#c62828",
					}}
				>
					<strong>❌ {error}</strong>
				</div>
			)}

			{loading ? (
				<p style={{ color: "#666" }}>Loading orders...</p>
			) : orders.length === 0 ? (
				<div
					style={{
						background: "#f5f5f5",
						borderRadius: 8,
						padding: 32,
						textAlign: "center",
						color: "#666",
					}}
				>
					<p style={{ fontSize: 18, margin: 0 }}>🎉 All caught up!</p>
					<p style={{ margin: "8px 0 0", fontSize: 14 }}>
						No paid orders are waiting for a timeslot selection.
					</p>
				</div>
			) : (
				<>
					{/* Summary */}
					<div
						style={{
							background: "#e3f2fd",
							border: "1px solid #1976d2",
							borderRadius: 8,
							padding: 16,
							marginBottom: 24,
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
						}}
					>
						<div>
							<strong style={{ color: "#1565c0" }}>
								{customerGroups.size} customer
								{customerGroups.size !== 1 ? "s" : ""} with {orders.length}{" "}
								order
								{orders.length !== 1 ? "s" : ""} waiting for timeslot selection
							</strong>
						</div>
						<button
							type="button"
							onClick={handleNotify}
							disabled={sending || !hasActiveTimeslots}
							style={{
								background: sending || !hasActiveTimeslots ? "#ccc" : "#1a1a2e",
								color: "#fff",
								border: "none",
								borderRadius: 6,
								padding: "10px 20px",
								fontSize: 14,
								fontWeight: 600,
								cursor:
									sending || !hasActiveTimeslots ? "not-allowed" : "pointer",
								whiteSpace: "nowrap",
							}}
						>
							{sending
								? "Sending..."
								: `📧 Notify ${customerGroups.size} Customer${customerGroups.size !== 1 ? "s" : ""}`}
						</button>
					</div>

					{/* Customer List */}
					<div
						style={{
							border: "1px solid #e0e0e0",
							borderRadius: 8,
							overflow: "hidden",
						}}
					>
						<table
							style={{
								width: "100%",
								borderCollapse: "collapse",
								fontSize: 14,
							}}
						>
							<thead>
								<tr
									style={{
										background: "#fafafa",
										borderBottom: "2px solid #e0e0e0",
									}}
								>
									<th
										style={{
											padding: "12px 16px",
											textAlign: "left",
											fontWeight: 600,
										}}
									>
										Customer
									</th>
									<th
										style={{
											padding: "12px 16px",
											textAlign: "left",
											fontWeight: 600,
										}}
									>
										Order(s)
									</th>
									<th
										style={{
											padding: "12px 16px",
											textAlign: "left",
											fontWeight: 600,
										}}
									>
										Paid Date
									</th>
								</tr>
							</thead>
							<tbody>
								{Array.from(customerGroups.values()).map((group) => (
									<tr
										key={group.email}
										style={{
											borderBottom: "1px solid #f0f0f0",
										}}
									>
										<td
											style={{
												padding: "12px 16px",
											}}
										>
											<div
												style={{
													fontWeight: 500,
												}}
											>
												{group.name}
											</div>
											<div
												style={{
													fontSize: 12,
													color: "#666",
												}}
											>
												{group.email}
											</div>
										</td>
										<td
											style={{
												padding: "12px 16px",
											}}
										>
											{group.orders.map((o) => (
												<div key={o.id}>
													<a
														href={`/admin/collections/orders/${o.id}`}
														style={{
															color: "#1976d2",
															textDecoration: "none",
														}}
													>
														{o.orderNumber}
													</a>
												</div>
											))}
										</td>
										<td
											style={{
												padding: "12px 16px",
												color: "#666",
											}}
										>
											{group.orders.map((o) => (
												<div key={o.id}>
													{new Date(o.createdAt).toLocaleDateString("en-NZ", {
														day: "numeric",
														month: "short",
														year: "numeric",
													})}
												</div>
											))}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</>
			)}
		</div>
	);
}
