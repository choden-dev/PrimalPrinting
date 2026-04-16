/**
 * IndexedDB-based persistence for uploaded PDF files in the cart.
 *
 * File objects cannot be serialized to localStorage/sessionStorage, but
 * IndexedDB supports storing Blobs and Files natively. This module provides
 * helpers to save and restore PdfCartItem data (including the actual File)
 * across page navigations — specifically the OAuth redirect flow.
 */

const DB_NAME = "primal-printing-cart";
const DB_VERSION = 1;
const STORE_NAME = "uploaded-pdfs";

/** Serializable representation of a PdfCartItem stored in IndexedDB. */
export interface StoredPdfItem {
	id: string;
	displayName: string;
	quantity: number;
	unitPrice: number;
	priceId: string;
	pages: number;
	isColor: boolean;
	file: File;
	productId: string;
}

// ── IndexedDB helpers ────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: "id" });
			}
		};

		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

/**
 * Save an array of PDF cart items to IndexedDB.
 * Replaces any previously stored items.
 */
export async function saveCartPdfs(items: StoredPdfItem[]): Promise<void> {
	const db = await openDB();
	const tx = db.transaction(STORE_NAME, "readwrite");
	const store = tx.objectStore(STORE_NAME);

	// Clear existing items first
	store.clear();

	for (const item of items) {
		store.put(item);
	}

	return new Promise((resolve, reject) => {
		tx.oncomplete = () => {
			db.close();
			resolve();
		};
		tx.onerror = () => {
			db.close();
			reject(tx.error);
		};
	});
}

/**
 * Load all stored PDF cart items from IndexedDB.
 * Returns an empty array if nothing is stored or if IndexedDB is unavailable.
 */
export async function loadCartPdfs(): Promise<StoredPdfItem[]> {
	try {
		const db = await openDB();
		const tx = db.transaction(STORE_NAME, "readonly");
		const store = tx.objectStore(STORE_NAME);
		const request = store.getAll();

		return new Promise((resolve, reject) => {
			request.onsuccess = () => {
				db.close();
				resolve(request.result as StoredPdfItem[]);
			};
			request.onerror = () => {
				db.close();
				reject(request.error);
			};
		});
	} catch {
		// IndexedDB may be unavailable (private browsing, etc.)
		return [];
	}
}

/**
 * Clear all stored PDF cart items from IndexedDB.
 */
export async function clearCartPdfs(): Promise<void> {
	try {
		const db = await openDB();
		const tx = db.transaction(STORE_NAME, "readwrite");
		tx.objectStore(STORE_NAME).clear();

		return new Promise((resolve, reject) => {
			tx.oncomplete = () => {
				db.close();
				resolve();
			};
			tx.onerror = () => {
				db.close();
				reject(tx.error);
			};
		});
	} catch {
		// Best effort
	}
}
