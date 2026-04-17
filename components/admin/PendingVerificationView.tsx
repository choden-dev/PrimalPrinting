"use client";

import { useCallback, useEffect, useState } from "react";
import BackToDashboard from "./BackToDashboard";

interface OrderData {
	id: string;
	orderNumber: string;
	status: string;
	paymentMethod: string | null;
	bankTransferProofKey: string | null;
	bankTransferVerified: boolean | null;
	pricing: { total: number };
	files: { fileName: string; copies: number }[];
	customer: { name: string; email: string } | string;
	createdAt: string;
}

/**
 * Custom Payload admin view: Bank Transfer Verification Queue.
 *
 * Shows all bank transfer orders that have not yet been verified,
 * allowing the admin to view proof images and mark them as verified.
 * Verification is optional — for record keeping only.
 */
export default function PendingVerificationView() {
	const [orders, setOrders] = useState<OrderData[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [approvingId, setApprovingId] = useState<string | null>(null);
	const [proofUrls, setProofUrls] = useState<Record<string, string>>({});

	const fetchOrders = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await fetch(
				"/api/orders?where[paymentMethod][equals]=BANK_TRANSFER&where[bankTransferVerified][equals]=false&depth=1&limit=50&sort=-createdAt",
			);
			if (!res.ok) throw new Error("Failed to fetch orders.");
			const data = await res.json();
			setOrders(data.docs || []);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load orders.");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchOrders();
	}, [fetchOrders]);

	const handleViewProof = useCallback(
		async (orderId: string, proofKey: string) => {
			if (proofUrls[orderId]) return; // already loaded
			try {
				const params = new URLSearchParams({
					key: proofKey,
					staging: "true",
				});
				const res = await fetch(`/api/admin/file-url?${params}`);
				if (!res.ok) throw new Error("Failed to get proof URL.");
				const { url } = await res.json();
				setProofUrls((prev) => ({ ...prev, [orderId]: url }));
			} catch (err) {
				window.alert(
					err instanceof Error ? err.message : "Failed to load proof.",
				);
			}
		},
		[proofUrls],
	);

	const handleApprove = useCallback(
		async (orderId: string) => {
			if (
				!window.confirm(
					"Mark this bank transfer as verified? This is for record keeping only.",
				)
			)
				return;

			setApprovingId(orderId);
			try {
				const res = await fetch(`/api/shop/${orderId}/approve-payment`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
				});
				if (!res.ok) {
					const data = await res.json();
					throw new Error(data.error || "Failed to verify.");
				}
				fetchOrders(); // Refresh list
			} catch (err) {
				window.alert(err instanceof Error ? err.message : "Failed to verify.");
			} finally {
				setApprovingId(null);
			}
		},
		[fetchOrders],
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
				<div>
					<h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700 }}>
						🧾 Verify Bank Transfers
					</h1>
					<p style={{ margin: "4px 0 0", color: "#666", fontSize: "14px" }}>
						{orders.length} order{orders.length !== 1 ? "s" : ""} pending
						verification
					</p>
				</div>
				<button
					type="button"
					onClick={fetchOrders}
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

			{loading && (
				<div style={{ textAlign: "center", padding: "48px", color: "#666" }}>
					Loading…
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

			{!loading && orders.length === 0 && (
				<div
					style={{
						textAlign: "center",
						padding: "48px",
						color: "#666",
						background: "#e8f5e9",
						borderRadius: "8px",
					}}
				>
					✅ No payments pending verification. All caught up!
				</div>
			)}

			{orders.map((order) => {
				const cust = getCustomerDisplay(order.customer);
				const proofUrl = proofUrls[order.id];
				const isApproving = approvingId === order.id;

				return (
					<div
						key={order.id}
						style={{
							border: "1px solid #e0e0e0",
							borderRadius: "8px",
							marginBottom: "16px",
							overflow: "hidden",
						}}
					>
						{/* Header */}
						<div
							style={{
								padding: "12px 16px",
								background: "#fff3e0",
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
								flexWrap: "wrap",
								gap: "8px",
							}}
						>
							<div>
								<a
									href={`/admin/collections/orders/${order.id}`}
									style={{
										fontWeight: 700,
										fontFamily: "monospace",
										fontSize: "16px",
										color: "#1565c0",
										textDecoration: "none",
									}}
								>
									{order.orderNumber}
								</a>
								<span
									style={{
										marginLeft: "12px",
										fontSize: "13px",
										color: "#666",
									}}
								>
									{cust.name} ({cust.email})
								</span>
							</div>
							<div
								style={{ display: "flex", alignItems: "center", gap: "8px" }}
							>
								<span style={{ fontWeight: 600, fontSize: "16px" }}>
									${((order.pricing?.total || 0) / 100).toFixed(2)}
								</span>
								<span style={{ fontSize: "12px", color: "#999" }}>
									{new Date(order.createdAt).toLocaleDateString("en-NZ", {
										day: "numeric",
										month: "short",
										hour: "2-digit",
										minute: "2-digit",
									})}
								</span>
							</div>
						</div>

						{/* Body */}
						<div style={{ padding: "16px" }}>
							{/* Files */}
							<div style={{ marginBottom: "12px" }}>
								<strong style={{ fontSize: "13px", color: "#666" }}>
									Files:
								</strong>
								{order.files?.map((f, i) => (
									<span
										key={`${f.fileName}-${i}`}
										style={{
											marginLeft: "8px",
											fontSize: "13px",
											background: "#f5f5f5",
											padding: "2px 8px",
											borderRadius: "4px",
										}}
									>
										{f.fileName} ×{f.copies}
									</span>
								))}
							</div>

							{/* Proof image */}
							{order.bankTransferProofKey && (
								<div style={{ marginBottom: "16px" }}>
									{!proofUrl ? (
										<button
											type="button"
											onClick={() =>
												handleViewProof(
													order.id,
													order.bankTransferProofKey as string,
												)
											}
											style={{
												padding: "8px 16px",
												background: "#e65100",
												color: "#fff",
												border: "none",
												borderRadius: "4px",
												fontSize: "13px",
												fontWeight: 600,
												cursor: "pointer",
											}}
										>
											🖼️ View Proof of Payment
										</button>
									) : (
										<div>
											{/* biome-ignore lint/performance/noImgElement: Presigned R2 URLs are dynamic and incompatible with next/image */}
											<img
												src={proofUrl}
												alt="Bank transfer proof"
												style={{
													maxWidth: "100%",
													maxHeight: "300px",
													borderRadius: "8px",
													border: "1px solid #ddd",
												}}
											/>
											<div style={{ marginTop: "4px" }}>
												<a
													href={proofUrl}
													target="_blank"
													rel="noopener noreferrer"
													style={{
														fontSize: "12px",
														color: "#1565c0",
														textDecoration: "underline",
													}}
												>
													Open full size ↗
												</a>
											</div>
										</div>
									)}
								</div>
							)}

							{/* Approve button */}
							<button
								type="button"
								onClick={() => handleApprove(order.id)}
								disabled={isApproving}
								style={{
									padding: "10px 24px",
									background: isApproving ? "#ccc" : "#4caf50",
									color: "#fff",
									border: "none",
									borderRadius: "6px",
									fontSize: "14px",
									fontWeight: 700,
									cursor: isApproving ? "not-allowed" : "pointer",
								}}
							>
								{isApproving ? "Verifying…" : "✓ Mark as Verified"}
							</button>
						</div>
					</div>
				);
			})}
		</div>
	);
}
