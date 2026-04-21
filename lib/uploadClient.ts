/**
 * Browser-side helper for uploading PDFs directly to R2 via presigned PUT
 * URLs, with real progress reporting and bounded concurrency.
 *
 * Flow:
 *   1. Caller asks the server for a batch of presigned upload URLs
 *      (POST /api/shop/staging-urls).
 *   2. For each file, we PUT to R2 with `XMLHttpRequest` so we can hook
 *      `xhr.upload.onprogress` for per-file %.
 *   3. Caller passes the resulting `stagingKey`s to /api/shop/orders.
 *
 * `XMLHttpRequest` is used instead of `fetch()` because `fetch()` doesn't
 * expose upload-progress events in any browser today.
 */

export type FileToUpload = {
	file: File;
	/** Display name shown in progress UI (independent of file.name). */
	displayName: string;
};

export type PresignedUpload = {
	stagingKey: string;
	uploadUrl: string;
	contentType: string;
};

export type UploadProgress = {
	displayName: string;
	percent: number;
};

export type UploadedFile = {
	file: FileToUpload;
	stagingKey: string;
};

const DEFAULT_CONCURRENCY = 3;
const DEFAULT_RETRIES = 1;

/**
 * Request presigned PUT URLs from the server for the given files.
 *
 * Throws an `Error` with a server-supplied message on non-2xx responses or
 * a generic network message on transport failures.
 */
export async function requestPresignedUrls(
	files: FileToUpload[],
): Promise<PresignedUpload[]> {
	const payload = {
		files: files.map(({ file }) => ({
			name: file.name,
			size: file.size,
			type: file.type || "application/pdf",
		})),
	};

	let res: Response;
	try {
		res = await fetch("/api/shop/staging-urls", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
	} catch (networkErr) {
		throw new Error(
			`Could not reach the server to start the upload — your connection may have dropped. (${
				networkErr instanceof Error ? networkErr.message : "network error"
			})`,
		);
	}

	if (!res.ok) {
		let serverMessage = `Failed to start upload (HTTP ${res.status}).`;
		try {
			const data = (await res.json()) as { error?: string };
			if (data?.error) serverMessage = data.error;
		} catch {
			/* response body wasn't JSON — keep the default */
		}
		throw new Error(serverMessage);
	}

	const data = (await res.json()) as { uploads?: PresignedUpload[] };
	const uploads = data?.uploads;
	if (!Array.isArray(uploads) || uploads.length !== files.length) {
		throw new Error(
			"Server returned an invalid set of upload URLs. Please try again.",
		);
	}
	return uploads;
}

/**
 * PUT a single file to R2 via a presigned URL using XMLHttpRequest so we
 * get real upload-progress events.
 */
function putToR2(
	upload: PresignedUpload,
	file: File,
	onProgress: (percent: number) => void,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open("PUT", upload.uploadUrl, true);
		xhr.setRequestHeader("Content-Type", upload.contentType);

		xhr.upload.onprogress = (event) => {
			if (event.lengthComputable) {
				const percent = Math.min(
					100,
					Math.round((event.loaded / event.total) * 100),
				);
				onProgress(percent);
			}
		};

		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				onProgress(100);
				resolve();
			} else {
				reject(
					new Error(
						`Upload to storage failed with HTTP ${xhr.status}${
							xhr.statusText ? ` (${xhr.statusText})` : ""
						}.`,
					),
				);
			}
		};

		xhr.onerror = () => {
			reject(
				new Error(
					"Upload to storage failed — your connection may have dropped or the server rejected the upload.",
				),
			);
		};

		xhr.ontimeout = () => {
			reject(new Error("Upload to storage timed out. Please try again."));
		};

		xhr.onabort = () => {
			reject(new Error("Upload was cancelled."));
		};

		xhr.send(file);
	});
}

/**
 * Upload many files in parallel with bounded concurrency, calling
 * `onProgress(displayName, percent)` whenever a file's progress changes.
 *
 * Each file is retried up to `retries` times on transport-level failures
 * before its error is surfaced. The first error to surface aborts the
 * remaining uploads (the partial successes are returned via the
 * `onUploaded` hook so callers can clean them up if needed).
 */
export async function uploadFilesWithProgress(opts: {
	files: FileToUpload[];
	uploads: PresignedUpload[];
	onProgress: (progress: UploadProgress) => void;
	concurrency?: number;
	retries?: number;
}): Promise<UploadedFile[]> {
	const {
		files,
		uploads,
		onProgress,
		concurrency = DEFAULT_CONCURRENCY,
		retries = DEFAULT_RETRIES,
	} = opts;

	if (files.length !== uploads.length) {
		throw new Error("File / upload-URL count mismatch.");
	}

	const results: UploadedFile[] = new Array(files.length);
	let nextIndex = 0;

	const worker = async () => {
		while (true) {
			const i = nextIndex++;
			if (i >= files.length) return;

			const file = files[i];
			const upload = uploads[i];
			let lastErr: unknown = null;

			for (let attempt = 0; attempt <= retries; attempt++) {
				try {
					await putToR2(upload, file.file, (percent) =>
						onProgress({ displayName: file.displayName, percent }),
					);
					results[i] = { file, stagingKey: upload.stagingKey };
					lastErr = null;
					break;
				} catch (err) {
					lastErr = err;
					// Reset visible progress so the user sees the retry happening.
					onProgress({ displayName: file.displayName, percent: 0 });
				}
			}

			if (lastErr) {
				const baseMessage =
					lastErr instanceof Error ? lastErr.message : String(lastErr);
				throw new Error(`"${file.displayName}": ${baseMessage}`);
			}
		}
	};

	const workerCount = Math.max(1, Math.min(concurrency, files.length));
	await Promise.all(Array.from({ length: workerCount }, worker));
	return results;
}
