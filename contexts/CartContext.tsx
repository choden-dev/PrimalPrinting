import { createContext, useCallback, useEffect, useRef, useState } from "react";
import {
	clearCartPdfs,
	loadCartPdfs,
	type StoredPdfItem,
	saveCartPdfs,
} from "../lib/cartStorage";
import { getItemsWithBulkDiscount } from "../lib/utils";
import type CartItem from "../types/models/CartItem";
import PdfCartItem from "../types/models/PdfCartItem";

type cartPackageOperation = (cartPackage: CartItem) => void;
type cartPdfOperation = (cartPackage: PdfCartItem) => void;
interface ICartContext {
	cartPackages: CartItem[];
	uploadedPdfs: PdfCartItem[];
	displayPriceString: string;
	isModalOpen: boolean;
	/**
	 * @deprecated probably doesn't need to be used
	 */
	hasDiscountApplied: boolean;
	setIsModalOpen: (newState: boolean) => void;
	addCartPackage: cartPackageOperation;
	updateCartPackage: cartPackageOperation;
	removeCartPackage: cartPackageOperation;
	addUploadedPdf: cartPdfOperation;
	updateUploadedPdf: cartPdfOperation;
	removeUploadedPdf: cartPdfOperation;
	/** Persist uploaded PDFs to IndexedDB (call before navigating away). */
	persistCart: () => Promise<void>;
}

const defaultCartContext: ICartContext = {
	cartPackages: [],
	uploadedPdfs: [],
	displayPriceString: "$0.00",
	isModalOpen: false,
	hasDiscountApplied: false,
	setIsModalOpen: (_state) => {},
	addCartPackage: (_cartPackage) => {},
	updateCartPackage: (_cartPackage) => {},
	removeCartPackage: (_cartPackage) => {},
	addUploadedPdf: (_cartPdf) => {},
	updateUploadedPdf: (_cartPdf) => {},
	removeUploadedPdf: (_cartPdf) => {},
	persistCart: async () => {},
};

export const CartContext = createContext<ICartContext>(defaultCartContext);

const replaceInArray = <T extends CartItem>(
	arrayToSearch: T[],
	itemToReplace: T,
) => {
	return arrayToSearch.map((item) =>
		item.id === itemToReplace.id ? itemToReplace : item,
	);
};

const alreadyInArray = <T extends CartItem>(
	arrayToSearch: T[],
	itemToCheck: T,
) => {
	return arrayToSearch.some((item) => item.id === itemToCheck.id);
};

export function CartContextProvider(props: React.PropsWithChildren) {
	const [cartPackages, setCartPackages] = useState<CartItem[]>([]);
	const [uploadedPdfs, setUploadedPdfs] = useState<PdfCartItem[]>([]);
	const [displayPriceString, setDisplayPriceString] = useState<string>(
		defaultCartContext.displayPriceString,
	);
	const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
	const [hasDiscountApplied, setHasDiscountApplied] = useState<boolean>(false);

	// Keep a ref to uploadedPdfs so persistCart always sees the latest value
	const uploadedPdfsRef = useRef(uploadedPdfs);
	uploadedPdfsRef.current = uploadedPdfs;

	// Restore uploaded PDFs from IndexedDB on mount (e.g. after OAuth redirect)
	useEffect(() => {
		async function restore() {
			try {
				const stored = await loadCartPdfs();
				if (stored.length === 0) return;

				const restored = stored.map(
					(item: StoredPdfItem) =>
						new PdfCartItem(
							item.id,
							item.displayName,
							item.quantity,
							item.unitPrice,
							item.priceId,
							item.pages,
							item.isColor,
							item.file,
							item.productId,
						),
				);

				setUploadedPdfs(restored);
				// Clear IndexedDB after successful restore
				await clearCartPdfs();
			} catch (err) {
				console.error("Failed to restore cart from IndexedDB:", err);
			}
		}

		restore();
	}, []);

	/**
	 * Persist the current uploaded PDFs to IndexedDB.
	 * Call this before navigating away (e.g. OAuth redirect) to preserve files.
	 */
	const persistCart = useCallback(async () => {
		const pdfs = uploadedPdfsRef.current;
		if (pdfs.length === 0) return;

		const items: StoredPdfItem[] = pdfs.map((pdf) => ({
			id: pdf.id,
			displayName: pdf.displayName,
			quantity: pdf.getQuantity(),
			unitPrice: pdf.getDisplayPrice() / pdf.getQuantity(),
			priceId: pdf.priceId,
			pages: pdf.getPages(),
			isColor: pdf.isColor,
			file: pdf.file,
			productId: pdf.productId,
		}));

		await saveCartPdfs(items);
	}, []);

	function addCartPackage(cartPackage: CartItem) {
		if (alreadyInArray(cartPackages, cartPackage)) {
			return;
		}
		setCartPackages([...cartPackages, cartPackage]);
	}

	function removeCartPackage(cartPackage: CartItem) {
		setCartPackages(
			cartPackages.filter((_cartPackage) => _cartPackage.id !== cartPackage.id),
		);
	}

	function _checkForDiscount() {
		const discountedItems = getItemsWithBulkDiscount([
			...(uploadedPdfs as CartItem[]),
			...cartPackages,
		]);
		setHasDiscountApplied(discountedItems !== undefined);
		return hasDiscountApplied;
	}

	function updateCartPackage(updatedCartPackage: CartItem) {
		setCartPackages(replaceInArray(cartPackages, updatedCartPackage));
	}

	function addUploadedPdf(cartPdf: PdfCartItem) {
		if (alreadyInArray(uploadedPdfs, cartPdf)) {
			return;
		}
		setUploadedPdfs([...uploadedPdfs, cartPdf]);
	}

	function updateUploadedPdf(updatedUploadedPdf: PdfCartItem) {
		setUploadedPdfs(replaceInArray(uploadedPdfs, updatedUploadedPdf));
	}

	function removeUploadedPdf(cartPdf: PdfCartItem) {
		setUploadedPdfs(
			uploadedPdfs.filter((_cartPdf) => _cartPdf.id !== cartPdf.id),
		);
	}

	const calculateTotalPrice = useCallback(() => {
		let sum = 0;
		for (const pdf of uploadedPdfs) {
			sum += pdf.getDisplayPrice();
		}
		for (const cartPackage of cartPackages) {
			sum += cartPackage.getDisplayPrice();
		}
		setDisplayPriceString(sum.toFixed(2));
	}, [cartPackages, uploadedPdfs]);

	useEffect(() => {
		calculateTotalPrice();
	}, [calculateTotalPrice]);

	const cartData: ICartContext = {
		cartPackages,
		uploadedPdfs,
		addCartPackage,
		updateCartPackage,
		updateUploadedPdf,
		hasDiscountApplied,
		isModalOpen,
		removeCartPackage,
		setIsModalOpen,
		displayPriceString,
		addUploadedPdf,
		removeUploadedPdf,
		persistCart,
	};

	return <CartContext.Provider value={cartData} {...props} />;
}
