import { createContext, ReactPropTypes, useEffect, useState } from "react";
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

export function CartContextProvider(props: any) {
  const [cartPackages, setCartPackages] = useState<CartItem[]>([]);
  const [uploadedPdfs, setUploadedPdfs] = useState<PdfCartItem[]>([]);
  const [displayPriceString, setDisplayPriceString] = useState<string>(
    defaultCartContext.displayPriceString
  );

  useEffect(() => {
    calculateTotalPrice();
  }, [cartPackages, uploadedPdfs]);

  function addCartPackage(cartPackage: CartItem) {
    setCartPackages([...cartPackages, cartPackage]);
  }

  function removeCartPackage(cartPackage: CartItem) {
    setCartPackages(
      cartPackages.filter((_cartPackage) => _cartPackage.id !== cartPackage.id)
    );
  }

  function updateCartPackage(updatedCartPackage: CartItem) {
    setCartPackages(replaceInArray(cartPackages, updatedCartPackage));
  }

  function addUploadedPdf(cartPdf: PdfCartItem) {
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
    setDisplayPriceString(sum.toFixed(2));
  };

  const cartData: ICartContext = {
    cartPackages,
    uploadedPdfs,
    addCartPackage,
    updateCartPackage,
    updateUploadedPdf,
    isModalOpen: defaultCartContext.isModalOpen,
    removeCartPackage,
    displayPriceString,
    addUploadedPdf,
    removeUploadedPdf,
  };

  return <CartContext.Provider value={cartData} {...props} />;
}
