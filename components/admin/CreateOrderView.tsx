"use client";

import { useCallback, useMemo, useState } from "react";
import {
	type FileToUpload,
	type PresignedUpload,
	uploadFilesWithProgress,
} from "../../lib/uploadClient";
import AdminQueryProvider from "./AdminQueryProvider";
import BackToDashboard from "./BackToDashboard";

/**
 * Admin custom view: manually create an order on behalf of a customer.
 *
 * Use case: a customer couldn't upload their files on the site, so the admin
 * uploads the PDFs for them and finalises a DRAFT order owned by that customer.
 * The customer can then resume the order from "My Orders" and go through the
 * normal timeslot selection + payment flow — this view simply puts them into
 * the payment stage.
 *
 * Flow:
 *  1. Search for and select the target customer (GET /api/admin/customers).
 *  2. Add one or more PDFs, each with copies + colour mode.
 *  3. Presign + upload directly to R2 (POST /api/admin/orders/staging-urls),
 *     scoped to the target customer's staging prefix.
 *  4. Finalise the DRAFT order (POST /api/admin/orders), which verifies the
 *     staged files server-side, counts pages, prices the order and creates it.
 */

interface Customer {
	id: string;
	email: string;
	name: string;
}

interface StagedFileEntry {
	/** Stable id for React keys. */
	id: string;
	file: File;
	copies: number;
	colorMode: "BW" | "COLOR";
}

interface CreatedOrder {
	id: string;
	orderNumber?: string;
	status: string;
	pricing?: {
		subtotal?: number;
		discount?: number;
		total?: number;
	};
}

const MAX_COPIES = 1000;

function formatCurrency(cents: number | undefined): string {
	if (typeof cents !== "number" || !Number.isFinite(cents)) return "—";
	return `$${(cents / 100).toFixed(2)}`;
}

function CreateOrderViewInner() {
	// ---- Customer search state ----
	const [searchTerm, setSearchTerm] = useState("");
	const [searchResults, setSearchResults] = useState<Customer[]>([]);
	const [searching, setSearching] = useState(false);
	const [searchError, setSearchError] = useState<string | null>(null);
	const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
		null,
	);

	// ---- File state ----
	const [stagedFiles, setStagedFiles] = useState<StagedFileEntry[]>([]);

	// ---- Submission state ----
	const [submitting, setSubmitting] = useState(false);
	const [progressLabel, setProgressLabel] = useState<string | null>(null);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
	const [copied, setCopied] = useState(false);

	const handleSearch = useCallback(async () => {
		setSearching(true);
		setSearchError(null);
		try {
			const res = await fetch(
				`/api/admin/customers?search=${encodeURIComponent(searchTerm)}&limit=20`,
			);
			if (!res.ok) {
				const data = (await res.json().catch(() => ({}))) as {
					error?: string;
				};
				throw new Error(data.error || `Search failed (HTTP ${res.status}).`);
			}
			const data = (await res.json()) as { customers?: Customer[] };
			setSearchResults(data.customers ?? []);
		} catch (err) {
			setSearchError(err instanceof Error ? err.message : "Search failed.");
			setSearchResults([]);
		} finally {
			setSearching(false);
		}
	}, [searchTerm]);

	const handleAddFiles = useCallback((fileList: FileList | null) => {
		if (!fileList || fileList.length === 0) return;
		const additions: StagedFileEntry[] = Array.from(fileList).map((file) => ({
			id: `${file.name}-${file.size}-${Date.now()}-${Math.random()
				.toString(36)
				.slice(2)}`,
			file,
			copies: 1,
			colorMode: "BW",
		}));
		setStagedFiles((prev) => [...prev, ...additions]);
	}, []);

	const updateEntry = useCallback(
		(id: string, patch: Partial<Omit<StagedFileEntry, "id" | "file">>) => {
			setStagedFiles((prev) =>
				prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
			);
		},
		[],
	);

	const removeEntry = useCallback((id: string) => {
		setStagedFiles((prev) => prev.filter((entry) => entry.id !== id));
	}, []);

	const canSubmit = useMemo(
		() => !!selectedCustomer && stagedFiles.length > 0 && !submitting,
		[selectedCustomer, stagedFiles.length, submitting],
	);

	const handleSubmit = useCallback(async () => {
		if (!selectedCustomer || stagedFiles.length === 0) return;
		setSubmitting(true);
		setSubmitError(null);
		setCreatedOrder(null);
		setProgressLabel("Requesting upload URLs…");

		try {
			// Step 1: request customer-scoped presigned upload URLs.
			const presignRes = await fetch("/api/admin/orders/staging-urls", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					customerId: selectedCustomer.id,
					files: stagedFiles.map((e) => ({
						name: e.file.name,
						size: e.file.size,
						type: e.file.type || "application/pdf",
					})),
				}),
			});
			if (!presignRes.ok) {
				const data = (await presignRes.json().catch(() => ({}))) as {
					error?: string;
				};
				throw new Error(
					data.error || `Failed to start upload (HTTP ${presignRes.status}).`,
				);
			}
			const presignData = (await presignRes.json()) as {
				uploads?: PresignedUpload[];
			};
			const uploads = presignData.uploads ?? [];
			if (uploads.length !== stagedFiles.length) {
				throw new Error(
					"Server returned an invalid set of upload URLs. Please try again.",
				);
			}

			// Step 2: upload each file directly to R2 with progress.
			const filesToUpload: FileToUpload[] = stagedFiles.map((e) => ({
				file: e.file,
				displayName: e.file.name,
			}));
			await uploadFilesWithProgress({
				files: filesToUpload,
				uploads,
				onProgress: ({ displayName, percent }) =>
					setProgressLabel(`Uploading ${displayName} — ${percent}%`),
			});

			// Step 3: finalise the DRAFT order. `uploads` preserves input order,
			// so stagingKey[i] corresponds to stagedFiles[i].
			setProgressLabel("Finalising order…");
			const finaliseRes = await fetch("/api/admin/orders", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					customerId: selectedCustomer.id,
					files: stagedFiles.map((e, i) => ({
						stagingKey: uploads[i].stagingKey,
						fileName: e.file.name,
						copies: e.copies,
						colorMode: e.colorMode,
					})),
				}),
			});
			if (!finaliseRes.ok) {
				const data = (await finaliseRes.json().catch(() => ({}))) as {
					error?: string;
				};
				throw new Error(
					data.error || `Failed to create order (HTTP ${finaliseRes.status}).`,
				);
			}
			const finaliseData = (await finaliseRes.json()) as {
				order?: CreatedOrder;
			};
			if (!finaliseData.order) {
				throw new Error("Order was created but the response was malformed.");
			}

			setCreatedOrder(finaliseData.order);
			setStagedFiles([]);
		} catch (err) {
			setSubmitError(
				err instanceof Error ? err.message : "Failed to create order.",
			);
		} finally {
			setSubmitting(false);
			setProgressLabel(null);
		}
	}, [selectedCustomer, stagedFiles]);

	const resetForNewOrder = useCallback(() => {
		setCreatedOrder(null);
		setSubmitError(null);
		setCopied(false);
	}, []);

	// Customer-facing link that resumes the order straight into the payment
	// step (see statusToStep in OrderContainer: DRAFT → PAYMENT). The admin can
	// copy this and send it to the customer so they land directly on payment.
	const resumeUrl = useMemo(() => {
		if (!createdOrder) return "";
		const origin = typeof window !== "undefined" ? window.location.origin : "";
		return `${origin}/order?resume=${createdOrder.id}`;
	}, [createdOrder]);

	const handleCopyResumeUrl = useCallback(async () => {
		if (!resumeUrl) return;
		try {
			await navigator.clipboard.writeText(resumeUrl);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard API can fail (e.g. insecure context) — leave the link
			// visible so the admin can select and copy it manually.
			setCopied(false);
		}
	}, [resumeUrl]);

	return (
		<div style={{ padding: "2rem", maxWidth: 860, margin: "0 auto" }}>
			<BackToDashboard />
			<h1 style={{ marginBottom: "0.25rem" }}>Create Order for Customer</h1>
			<p style={{ color: "var(--theme-elevation-600)", marginTop: 0 }}>
				Manually upload a customer's files and put them into the payment stage.
				The customer can then pick a pickup slot and pay from “My Orders”.
			</p>

			{/* ---- Step 1: Customer ---- */}
			<section style={{ marginTop: "1.5rem" }}>
				<h2 style={{ fontSize: "1.1rem" }}>1. Select customer</h2>
				{selectedCustomer ? (
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							gap: "1rem",
							padding: "0.75rem 1rem",
							border: "1px solid var(--theme-elevation-150)",
							borderRadius: 6,
						}}
					>
						<div>
							<strong>{selectedCustomer.name || "(no name)"}</strong>
							<div style={{ color: "var(--theme-elevation-600)" }}>
								{selectedCustomer.email}
							</div>
						</div>
						<button
							type="button"
							onClick={() => setSelectedCustomer(null)}
							disabled={submitting}
						>
							Change
						</button>
					</div>
				) : (
					<>
						<div style={{ display: "flex", gap: "0.5rem" }}>
							<input
								type="text"
								value={searchTerm}
								placeholder="Search by name or email…"
								onChange={(e) => setSearchTerm(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") handleSearch();
								}}
								style={{ flex: 1, padding: "0.5rem" }}
							/>
							<button type="button" onClick={handleSearch} disabled={searching}>
								{searching ? "Searching…" : "Search"}
							</button>
						</div>
						{searchError && (
							<p style={{ color: "var(--theme-error-500, #c00)" }}>
								{searchError}
							</p>
						)}
						{searchResults.length > 0 && (
							<ul
								style={{
									listStyle: "none",
									padding: 0,
									marginTop: "0.75rem",
									border: "1px solid var(--theme-elevation-150)",
									borderRadius: 6,
								}}
							>
								{searchResults.map((c) => (
									<li
										key={c.id}
										style={{
											borderBottom: "1px solid var(--theme-elevation-100)",
										}}
									>
										<button
											type="button"
											onClick={() => {
												setSelectedCustomer(c);
												setSearchResults([]);
											}}
											style={{
												display: "block",
												width: "100%",
												textAlign: "left",
												padding: "0.6rem 1rem",
												background: "transparent",
												border: "none",
												cursor: "pointer",
											}}
										>
											<strong>{c.name || "(no name)"}</strong>
											<span
												style={{
													color: "var(--theme-elevation-600)",
													marginLeft: 8,
												}}
											>
												{c.email}
											</span>
										</button>
									</li>
								))}
							</ul>
						)}
					</>
				)}
			</section>

			{/* ---- Step 2: Files ---- */}
			<section style={{ marginTop: "2rem" }}>
				<h2 style={{ fontSize: "1.1rem" }}>2. Add files</h2>
				<input
					type="file"
					accept="application/pdf"
					multiple
					disabled={submitting}
					onChange={(e) => {
						handleAddFiles(e.target.files);
						e.target.value = "";
					}}
				/>
				{stagedFiles.length > 0 && (
					<table
						style={{
							width: "100%",
							marginTop: "1rem",
							borderCollapse: "collapse",
						}}
					>
						<thead>
							<tr style={{ textAlign: "left" }}>
								<th style={{ padding: "0.4rem" }}>File</th>
								<th style={{ padding: "0.4rem", width: 110 }}>Copies</th>
								<th style={{ padding: "0.4rem", width: 130 }}>Colour</th>
								<th style={{ padding: "0.4rem", width: 60 }} />
							</tr>
						</thead>
						<tbody>
							{stagedFiles.map((entry) => (
								<tr
									key={entry.id}
									style={{ borderTop: "1px solid var(--theme-elevation-100)" }}
								>
									<td style={{ padding: "0.4rem" }}>{entry.file.name}</td>
									<td style={{ padding: "0.4rem" }}>
										<input
											type="number"
											min={1}
											max={MAX_COPIES}
											value={entry.copies}
											disabled={submitting}
											onChange={(e) => {
												const n = Number.parseInt(e.target.value, 10);
												updateEntry(entry.id, {
													copies: Number.isFinite(n)
														? Math.min(Math.max(n, 1), MAX_COPIES)
														: 1,
												});
											}}
											style={{ width: 80, padding: "0.3rem" }}
										/>
									</td>
									<td style={{ padding: "0.4rem" }}>
										<select
											value={entry.colorMode}
											disabled={submitting}
											onChange={(e) =>
												updateEntry(entry.id, {
													colorMode: e.target.value as "BW" | "COLOR",
												})
											}
											style={{ padding: "0.3rem" }}
										>
											<option value="BW">B &amp; W</option>
											<option value="COLOR">Colour</option>
										</select>
									</td>
									<td style={{ padding: "0.4rem" }}>
										<button
											type="button"
											onClick={() => removeEntry(entry.id)}
											disabled={submitting}
										>
											✕
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</section>

			{/* ---- Step 3: Submit ---- */}
			<section style={{ marginTop: "2rem" }}>
				<button
					type="button"
					onClick={handleSubmit}
					disabled={!canSubmit}
					style={{
						padding: "0.6rem 1.4rem",
						fontWeight: 600,
						cursor: canSubmit ? "pointer" : "not-allowed",
					}}
				>
					{submitting ? "Creating…" : "Create draft order"}
				</button>
				{progressLabel && (
					<p style={{ color: "var(--theme-elevation-600)" }}>{progressLabel}</p>
				)}
				{submitError && (
					<p style={{ color: "var(--theme-error-500, #c00)" }}>{submitError}</p>
				)}
			</section>

			{/* ---- Success ---- */}
			{createdOrder && (
				<section
					style={{
						marginTop: "2rem",
						padding: "1rem 1.25rem",
						border: "1px solid var(--theme-success-500, #2e7d32)",
						borderRadius: 6,
					}}
				>
					<h2 style={{ fontSize: "1.1rem", marginTop: 0 }}>
						✅ Draft order created
					</h2>
					<p style={{ margin: "0.25rem 0" }}>
						Order <strong>{createdOrder.orderNumber || createdOrder.id}</strong>{" "}
						is now a {createdOrder.status}. The customer can select a pickup
						slot and pay from “My Orders”.
					</p>
					<p style={{ margin: "0.25rem 0" }}>
						Total:{" "}
						<strong>{formatCurrency(createdOrder.pricing?.total)}</strong>
					</p>
					<div style={{ margin: "0.75rem 0" }}>
						<label
							htmlFor="resume-link"
							style={{
								display: "block",
								fontWeight: 600,
								marginBottom: "0.25rem",
							}}
						>
							Send this link to the customer to pay:
						</label>
						<div style={{ display: "flex", gap: "0.5rem" }}>
							<input
								id="resume-link"
								type="text"
								readOnly
								value={resumeUrl}
								onFocus={(e) => e.target.select()}
								style={{
									flex: 1,
									padding: "0.5rem",
									fontFamily: "monospace",
								}}
							/>
							<button type="button" onClick={handleCopyResumeUrl}>
								{copied ? "Copied!" : "Copy link"}
							</button>
						</div>
						<p
							style={{
								margin: "0.25rem 0 0",
								color: "var(--theme-elevation-600)",
								fontSize: "0.85rem",
							}}
						>
							Opens the order directly on the payment step (customer must sign
							in). It's also available under “My Orders”.
						</p>
					</div>
					<button type="button" onClick={resetForNewOrder}>
						Create another order
					</button>
				</section>
			)}
		</div>
	);
}

/**
 * Default export wraps the view in `AdminQueryProvider` so it matches the
 * admin (App Router) provider pattern used by other custom views, even though
 * this view currently uses plain fetch — this keeps it consistent and ready
 * for future React Query migration.
 */
export default function CreateOrderView() {
	return (
		<AdminQueryProvider>
			<CreateOrderViewInner />
		</AdminQueryProvider>
	);
}
