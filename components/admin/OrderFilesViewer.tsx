"use client";

import { useDocumentInfo } from "@payloadcms/ui";
import { useCallback, useState } from "react";
import { type OrderStatusValue, PAID_STATUSES } from "../../types/orderStatus";

interface OrderFile {
	fileName: string;
	stagingKey: string;
	permanentKey?: string;
	pageCount: number;
	copies: number;
	colorMode: string;
	paperSize: string;
	doubleSided: boolean;
	fileSize: number;
}

interface OrderDocumentData {
	status?: string;
	files?: OrderFile[];
	bankTransferProofKey?: string;
}

/**
 * Payload admin custom component: Order Files Viewer.
 *
 * Replaces the raw R2 key strings with a friendly file list that includes:
 * - File name, size, page count, print settings
 * - "View / Download" button that generates a presigned R2 URL
 * - Visual indicator of whether the file is in staging or permanent storage
 */
export const OrderFilesViewer: React.FC = () => {
	const { initialData } = useDocumentInfo();
	const files = ((initialData as OrderDocumentData)?.files ||
		[]) as OrderFile[];
	const status = (initialData as OrderDocumentData)?.status as string;
	const bankTransferProofKey = (initialData as OrderDocumentData)
		?.bankTransferProofKey as string;

	if (files.length === 0 && !bankTransferProofKey) return null;

	const isPaid = PAID_STATUSES.includes(status as OrderStatusValue);

	return (
		<div
			style={{
				padding: "16px",
				marginBottom: "16px",
				background: "#f8f9fa",
				borderRadius: "8px",
				border: "1px solid #e0e0e0",
			}}
		>
			<h4 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: 600 }}>
				📄 Order Files
			</h4>

					{files.map((file) => (
						<FileRow
							key={`${file.fileName}-${file.copies}-${file.colorMode}`}
					file={file}
					isPaid={isPaid}
				/>
			))}

			{bankTransferProofKey && (
				<div style={{ marginTop: "16px" }}>
					<h4
						style={{
							margin: "0 0 8px",
							fontSize: "14px",
							fontWeight: 600,
							color: "#e65100",
						}}
					>
						🧾 Bank Transfer Proof
					</h4>
					<ProofViewer proofKey={bankTransferProofKey} isPaid={isPaid} />
				</div>
			)}
		</div>
	);
};

// ── File row component ───────────────────────────────────────────────

function FileRow({ file, isPaid }: { file: OrderFile; isPaid: boolean }) {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fileKey =
		isPaid && file.permanentKey ? file.permanentKey : file.stagingKey;
	const isStaging = !isPaid || !file.permanentKey;

	const handleView = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const params = new URLSearchParams({
				key: fileKey,
				staging: isStaging.toString(),
			});
			const res = await fetch(`/api/admin/file-url?${params}`);
			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || "Failed to get file URL.");
			}
			const { url } = await res.json();
			window.open(url, "_blank");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to open file.");
		} finally {
			setLoading(false);
		}
	}, [fileKey, isStaging]);

	const fileSizeMB = (file.fileSize / (1024 * 1024)).toFixed(2);

	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				padding: "10px 12px",
				background: "#fff",
				borderRadius: "6px",
				marginBottom: "6px",
				border: "1px solid #eee",
				flexWrap: "wrap",
				gap: "8px",
			}}
		>
			<div style={{ flex: 1, minWidth: "200px" }}>
				<div style={{ fontWeight: 600, fontSize: "14px" }}>
					📎 {file.fileName}
				</div>
				<div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>
					{file.pageCount} pages · {file.copies}{" "}
					{file.copies === 1 ? "copy" : "copies"} ·{" "}
					{file.colorMode === "COLOR" ? "Colour" : "B&W"} · {file.paperSize} ·{" "}
					{file.doubleSided ? "Double-sided" : "Single-sided"} · {fileSizeMB} MB
				</div>
			</div>

			<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
				<span
					style={{
						fontSize: "11px",
						padding: "2px 8px",
						borderRadius: "10px",
						background: isStaging ? "#fff3e0" : "#e8f5e9",
						color: isStaging ? "#e65100" : "#2e7d32",
						fontWeight: 600,
					}}
				>
					{isStaging ? "Staging" : "Permanent"}
				</span>
				<button
					type="button"
					onClick={handleView}
					disabled={loading}
					style={{
						padding: "6px 14px",
						background: loading ? "#ccc" : "#1a1a2e",
						color: "#fff",
						border: "none",
						borderRadius: "4px",
						fontSize: "12px",
						fontWeight: 600,
						cursor: loading ? "not-allowed" : "pointer",
					}}
				>
					{loading ? "Loading…" : "View / Download"}
				</button>
			</div>

			{error && (
				<div
					style={{
						width: "100%",
						fontSize: "12px",
						color: "#d32f2f",
						marginTop: "4px",
					}}
				>
					{error}
				</div>
			)}
		</div>
	);
}

// ── Bank transfer proof viewer ───────────────────────────────────────

function ProofViewer({
	proofKey,
	isPaid,
}: {
	proofKey: string;
	isPaid: boolean;
}) {
	const [loading, setLoading] = useState(false);
	const [imageUrl, setImageUrl] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const handleView = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const params = new URLSearchParams({
				key: proofKey,
				staging: (!isPaid).toString(),
			});
			const res = await fetch(`/api/admin/file-url?${params}`);
			if (!res.ok) throw new Error("Failed to get proof URL.");
			const { url } = await res.json();
			setImageUrl(url);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load proof.");
		} finally {
			setLoading(false);
		}
	}, [proofKey, isPaid]);

	return (
		<div>
			{!imageUrl ? (
				<button
					type="button"
					onClick={handleView}
					disabled={loading}
					style={{
						padding: "8px 16px",
						background: loading ? "#ccc" : "#e65100",
						color: "#fff",
						border: "none",
						borderRadius: "4px",
						fontSize: "13px",
						fontWeight: 600,
						cursor: loading ? "not-allowed" : "pointer",
					}}
				>
					{loading ? "Loading…" : "🖼️ View Proof Image"}
				</button>
			) : (
				<div>
					{/* biome-ignore lint/performance/noImgElement: Presigned R2 URLs are dynamic and incompatible with next/image */}
					<img
						src={imageUrl}
						alt="Bank transfer proof"
						style={{
							maxWidth: "100%",
							maxHeight: "400px",
							borderRadius: "8px",
							border: "1px solid #ddd",
							marginTop: "8px",
						}}
					/>
					<div style={{ marginTop: "8px" }}>
						<a
							href={imageUrl}
							target="_blank"
							rel="noopener noreferrer"
							style={{
								fontSize: "12px",
								color: "#1565c0",
								textDecoration: "underline",
							}}
						>
							Open in new tab ↗
						</a>
					</div>
				</div>
			)}
			{error && (
				<div style={{ fontSize: "12px", color: "#d32f2f", marginTop: "4px" }}>
					{error}
				</div>
			)}
		</div>
	);
}

export default OrderFilesViewer;
