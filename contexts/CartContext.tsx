import { createContext, useCallback, useEffect, useState } from "react";
import { getItemsWithBulkDiscount } from "../lib/utils";
import type CartItem from "../types/models/CartItem";
import type PdfCartItem from "../types/models/PdfCartItem";

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

export function CartContextProvider(props: React.PropsWithChildren<{}>) {
	const [cartPackages, setCartPackages] = useState<CartItem[]>([]);
	const [uploadedPdfs, setUploadedPdfs] = useState<PdfCartItem[]>([]);
	const [displayPriceString, setDisplayPriceString] = useState<string>(
		defaultCartContext.displayPriceString,
	);
	const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
	const [hasDiscountApplied, setHasDiscountApplied] = useState<boolean>(false);

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
		uploadedPdfs.map((pdf) => {
			sum += pdf.getDisplayPrice();
		});
		cartPackages.map((cartPackage) => {
			sum += cartPackage.getDisplayPrice();
		});
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
	};

	return <CartContext.Provider value={cartData} {...props} />;
}
