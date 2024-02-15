import { createContext, ReactPropTypes, useEffect, useState } from "react";
import { hasBulkDiscount } from "../lib/utils";
import { getPercentOff } from "../lib/utils";
import CartItem from "../types/models/CartItem";
import PdfCartItem from "../types/models/PdfCartItem";
import { UploadedPdf } from "../types/types";

type cartPackageOperation = (cartPackage: CartItem) => void;
type cartPdfOperation = (cartPackage: PdfCartItem) => void;
interface ICartContext {
  cartPackages: CartItem[];
  uploadedPdfs: PdfCartItem[];
  displayPriceString: string;
  isModalOpen: boolean;
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
  setIsModalOpen: (state) => {},
  addCartPackage: (cartPackage) => {},
  updateCartPackage: (cartPackage) => {},
  removeCartPackage: (cartPackage) => {},
  addUploadedPdf: (cartPdf) => {},
  updateUploadedPdf: (cartPdf) => {},
  removeUploadedPdf: (cartPdf) => {},
};

export const CartContext = createContext<ICartContext>(defaultCartContext);

const replaceInArray = <T extends CartItem>(
  arrayToSearch: T[],
  itemToReplace: T
) => {
  return arrayToSearch.map((item) =>
    item.id === itemToReplace.id ? itemToReplace : item
  );
};

const alreadyInArray = <T extends CartItem>(
  arrayToSearch: T[],
  itemToCheck: T
) => {
  return arrayToSearch.some((item) => item.id === itemToCheck.id);
};

export function CartContextProvider(props: any) {
  const [cartPackages, setCartPackages] = useState<CartItem[]>([]);
  const [uploadedPdfs, setUploadedPdfs] = useState<PdfCartItem[]>([]);
  const [displayPriceString, setDisplayPriceString] = useState<string>(
    defaultCartContext.displayPriceString
  );
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [hasDiscountApplied, setHasDiscountApplied] = useState<boolean>(false);

  useEffect(() => {
    calculateTotalPrice();
  }, [cartPackages, uploadedPdfs]);

  function addCartPackage(cartPackage: CartItem) {
    if (alreadyInArray(cartPackages, cartPackage)) {
      return;
    }
    setCartPackages([...cartPackages, cartPackage]);
  }

  function removeCartPackage(cartPackage: CartItem) {
    setCartPackages(
      cartPackages.filter((_cartPackage) => _cartPackage.id !== cartPackage.id)
    );
  }

  function checkForDiscount() {
    const hasDiscount = hasBulkDiscount([
      ...(uploadedPdfs as CartItem[]),
      ...cartPackages,
    ]);
    setHasDiscountApplied(hasDiscount);
    return hasDiscount;
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
      uploadedPdfs.filter((_cartPdf) => _cartPdf.id !== cartPdf.id)
    );
  }

  const calculateTotalPrice = () => {
    let sum = 0;
    uploadedPdfs.map((pdf) => {
      sum += pdf.getDisplayPrice();
    });
    cartPackages.map((cartPackage) => {
      sum += cartPackage.getDisplayPrice();
    });
    if (checkForDiscount()) {
      sum = sum * ((100 - getPercentOff()) / 100);
    }
    setDisplayPriceString(sum.toFixed(2));
  };

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
