"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface BankDetailsData {
	accountName: string;
	bankName: string;
	accountNumber: string;
	instructions: string;
}

interface BankTransferFormProps {
	/** The order ID to submit bank transfer for */
	orderId: string;
	/** The order number to display */
	orderNumber: string;
	/** Order total for display (in cents) */
	totalCents: number;
	/** Called when proof is submitted successfully */
	onSuccess: () => void;
	/** Called on error */
	onError?: (error: string) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Bank transfer payment form with proof of payment upload.
 *
 * Shows bank account details, lets the user upload a screenshot
 * of their transfer, and submits it for admin verification.
 *
 * ```tsx
 * <BankTransferForm
 *   orderId={order.id}
 *   orderNumber={order.orderNumber}
 *   totalCents={order.pricing.total}
 *   onSuccess={() => router.push(`/order_complete?orderId=${order.id}`)}
 * />
 * ```
 */
export function BankTransferForm({
	orderId,
	orderNumber,
	totalCents,
	onSuccess,
	onError,
}: BankTransferFormProps) {
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [preview, setPreview] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [bankDetails, setBankDetails] = useState<BankDetailsData | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Fetch bank account details from Payload global
	useEffect(() => {
		async function fetchBankDetails() {
			try {
				const res = await fetch("/api/shop/bank-details");
				if (res.ok) {
					const data = await res.json();
					setBankDetails(data.bankDetails);
				}
			} catch {
				// Silently fail — form still works without details
			}
		}
		fetchBankDetails();
	}, []);

	const handleFileSelect = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file) return;

			if (!ALLOWED_TYPES.includes(file.type)) {
				setError("Only JPEG, PNG, and WebP images are accepted.");
				return;
			}

			if (file.size > MAX_FILE_SIZE) {
				setError("Image is too large. Maximum size is 10MB.");
				return;
			}

			setError(null);
			setSelectedFile(file);

			// Create preview
			const reader = new FileReader();
			reader.onload = (ev) => setPreview(ev.target?.result as string);
			reader.readAsDataURL(file);
		},
		[],
	);

	const handleSubmit = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault();
			if (!selectedFile) {
				setError("Please upload proof of payment.");
				return;
			}

			setLoading(true);
			setError(null);

			try {
				// Step 1: Upload proof image
				const uploadFormData = new FormData();
				uploadFormData.append("image", selectedFile);
				uploadFormData.append("orderNumber", orderNumber);

				const uploadRes = await fetch("/api/shop/upload-proof", {
					method: "POST",
					body: uploadFormData,
				});

				if (!uploadRes.ok) {
					const data = await uploadRes.json();
					throw new Error(data.error || "Failed to upload proof image.");
				}

				const { proofKey } = await uploadRes.json();

				// Step 2: Submit bank transfer with proof key
				const submitRes = await fetch(
					`/api/shop/${orderId}/submit-bank-transfer`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ proofKey }),
					},
				);

				if (!submitRes.ok) {
					const data = await submitRes.json();
					throw new Error(data.error || "Failed to submit bank transfer.");
				}

				onSuccess();
			} catch (err) {
				const msg =
					err instanceof Error
						? err.message
						: "Failed to submit bank transfer.";
				setError(msg);
				onError?.(msg);
			} finally {
				setLoading(false);
			}
		},
		[selectedFile, orderId, orderNumber, onSuccess, onError],
	);

	return (
		<form onSubmit={handleSubmit}>
			{/* Bank details */}
			<div
				style={{
					background: "#f5f5f5",
					borderRadius: "8px",
					padding: "16px",
					marginBottom: "20px",
				}}
			>
				<h4 style={{ margin: "0 0 12px", fontSize: "16px" }}>
					🏦 Bank Transfer Details
				</h4>
				<p style={{ margin: "4px 0", fontSize: "14px", color: "#666" }}>
					Please transfer <strong>${(totalCents / 100).toFixed(2)}</strong> to
					the following account:
				</p>
				<div
					style={{
						background: "#fff",
						borderRadius: "6px",
						padding: "12px",
						marginTop: "8px",
						fontSize: "14px",
					}}
				>
					{bankDetails ? (
						<>
							<p style={{ margin: "4px 0" }}>
								<strong>Bank:</strong> {bankDetails.bankName}
							</p>
							<p style={{ margin: "4px 0" }}>
								<strong>Account Name:</strong> {bankDetails.accountName}
							</p>
							<p style={{ margin: "4px 0" }}>
								<strong>Account Number:</strong> {bankDetails.accountNumber}
							</p>
							<p style={{ margin: "8px 0 4px" }}>
								<strong>Reference:</strong> {orderNumber}
							</p>
							{bankDetails.instructions && (
								<p
									style={{
										margin: "8px 0 0",
										fontSize: "13px",
										color: "#666",
										fontStyle: "italic",
									}}
								>
									{bankDetails.instructions}
								</p>
							)}
						</>
					) : (
						<p style={{ margin: "4px 0", color: "#999" }}>
							Loading bank details…
						</p>
					)}
					<p
						style={{
							margin: "8px 0 0",
							fontSize: "12px",
							color: "#e65100",
							fontWeight: 600,
						}}
					>
						Please include your order number as the payment reference.
					</p>
				</div>
			</div>

			{/* Proof upload */}
			<div style={{ marginBottom: "20px" }}>
				<h4 style={{ margin: "0 0 8px", fontSize: "16px" }}>
					📷 Upload Proof of Payment
				</h4>
				<p
					style={{
						margin: "0 0 12px",
						fontSize: "14px",
						color: "#666",
					}}
				>
					Upload a screenshot of your bank transfer confirmation.
				</p>

				<input
					ref={fileInputRef}
					type="file"
					accept="image/jpeg,image/png,image/webp"
					onChange={handleFileSelect}
					style={{ display: "none" }}
				/>

				<button
					type="button"
					onClick={() => fileInputRef.current?.click()}
					style={{
						padding: "12px 24px",
						border: "2px dashed #ccc",
						borderRadius: "8px",
						background: "transparent",
						cursor: "pointer",
						width: "100%",
						fontSize: "14px",
						color: "#666",
					}}
				>
					{selectedFile
						? `📎 ${selectedFile.name}`
						: "📷 Click to select image"}
				</button>

				{preview && (
					<div style={{ marginTop: "12px", textAlign: "center" }}>
						<img
							src={preview}
							alt="Payment proof preview"
							style={{
								maxWidth: "100%",
								maxHeight: "200px",
								borderRadius: "8px",
								border: "1px solid #eee",
							}}
						/>
					</div>
				)}
			</div>

			{error && (
				<p
					style={{
						color: "#d32f2f",
						fontSize: "14px",
						marginBottom: "12px",
					}}
				>
					{error}
				</p>
			)}

			<button
				type="submit"
				disabled={!selectedFile || loading}
				style={{
					width: "100%",
					padding: "14px",
					background: !selectedFile || loading ? "#ccc" : "#1a1a2e",
					color: "#fff",
					border: "none",
					borderRadius: "8px",
					fontSize: "16px",
					fontWeight: 600,
					cursor: !selectedFile || loading ? "not-allowed" : "pointer",
				}}
			>
				{loading ? "⏳ Submitting…" : "✅ Submit Proof of Payment"}
			</button>
		</form>
	);
}

export default BankTransferForm;
