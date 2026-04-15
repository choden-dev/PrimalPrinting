import {
	Box,
	Button,
	Divider,
	Heading,
	List,
	ListItem,
	Spinner,
	Text,
} from "@chakra-ui/react";
import { useCallback, useContext, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { CartContext } from "../../contexts/CartContext";
import type CartItem from "../../types/models/CartItem";
import DiscountBadge from "../discountbadge/DiscountBadge";
import QuantityPicker from "../quantitypicker/QuantityPicker";

type Props = {
	smallScreen: boolean;
	onProceedToPayment: (orderId: string, orderNumber: string) => void;
	setIsProcessing: (value: boolean) => void;
	setCurrentlyUploading: React.Dispatch<
		React.SetStateAction<{ name: string; percent: number }[]>
	>;
};

const CartItemContainer = () => {
	const { cartPackages, removeCartPackage, updateCartPackage } =
		useContext(CartContext);
	return (
		<>
			{cartPackages.map((cartPackage: CartItem) => {
				return (
					<ListItem key={cartPackage.id}>
						<Box
							display="flex"
							border="1px solid"
							borderColor="brown.700"
							padding="1rem"
							borderRadius="sm"
							marginBottom=".5rem"
						>
							<Text>
								{cartPackage.displayName} |{" "}
								<strong>${cartPackage.getDisplayPrice().toFixed(2)}</strong>
							</Text>
							<Box
								marginLeft="auto"
								display="flex"
								gap="1rem"
								alignItems="center"
							>
								<DiscountBadge
									displayCondition={cartPackage.shouldApplyDiscount()}
								/>
								<QuantityPicker
									defaultValue={cartPackage.getQuantity()}
									onChange={(_, value) => {
										cartPackage.setQuantity(value);
										updateCartPackage(cartPackage);
									}}
								/>
								<Text
									marginLeft="auto"
									fontWeight="800"
									cursor="pointer"
									onClick={() => {
										removeCartPackage(cartPackage);
									}}
								>
									X
								</Text>
							</Box>
						</Box>
					</ListItem>
				);
			})}
		</>
	);
};

const PdfItemContainer = () => {
	const { uploadedPdfs, updateUploadedPdf, removeUploadedPdf } =
		useContext(CartContext);
	return (
		<>
			{uploadedPdfs && (
				<>
					<Heading as="span" fontSize="1rem">
						Uploaded Files
					</Heading>
					<Divider marginBottom=".5rem" />
					{uploadedPdfs.map((pdf) => {
						return (
							<ListItem key={pdf.id} marginBottom=".5rem">
								<Box
									display="flex"
									border="1px solid"
									borderColor="brown.700"
									padding="1rem"
									borderRadius="sm"
									marginBottom=".5rem"
								>
									<Text>
										{pdf.displayName} |{" "}
										<strong>${pdf.getDisplayPrice().toFixed(2)}</strong>
									</Text>
									<Box
										marginLeft="auto"
										display="flex"
										gap="1rem"
										alignItems="center"
									>
										<DiscountBadge
											displayCondition={pdf.shouldApplyDiscount()}
										/>
										<QuantityPicker
											defaultValue={pdf.getQuantity()}
											onChange={(_, value) => {
												pdf.setQuantity(value);
												updateUploadedPdf(pdf);
											}}
										/>
										<Text
											marginLeft="auto"
											fontWeight="800"
											cursor="pointer"
											onClick={() => {
												removeUploadedPdf(pdf);
											}}
										>
											X
										</Text>
									</Box>
								</Box>
							</ListItem>
						);
					})}
				</>
			)}
		</>
	);
};

const Cart = ({
	smallScreen,
	onProceedToPayment,
	setIsProcessing,
	setCurrentlyUploading,
}: Props) => {
	const { cartPackages, uploadedPdfs, displayPriceString } =
		useContext(CartContext);
	const { isAuthenticated, isLoading: authLoading, login } = useAuth();
	const [isCreatingOrder, setIsCreatingOrder] = useState(false);

	/**
	 * Upload all PDFs to the R2 staging bucket, then create a DRAFT order
	 * in Payload and proceed to the payment step.
	 */
	const handleOrderNow = useCallback(async () => {
		const cartValid =
			(cartPackages && cartPackages.length !== 0) ||
			(uploadedPdfs && uploadedPdfs.length !== 0);
		if (!cartValid) {
			window.alert("Please choose a package or upload a pdf.");
			return;
		}

		if (!isAuthenticated) {
			login();
			return;
		}

		setIsCreatingOrder(true);
		setIsProcessing(true);

		try {
			// Step 1: Upload PDFs to R2 staging bucket
			const uploadedFiles: {
				fileName: string;
				stagingKey: string;
				pageCount: number;
				copies: number;
				colorMode: string;
				fileSize: number;
			}[] = [];

			for (let i = 0; i < uploadedPdfs.length; i++) {
				const pdf = uploadedPdfs[i];
				setCurrentlyUploading((prev) => {
					const updated = [...prev];
					updated[i] = { name: pdf.displayName, percent: 0 };
					return updated;
				});

				const formData = new FormData();
				formData.append("file", pdf.file);

				const uploadRes = await fetch("/api/shop/upload", {
					method: "POST",
					body: formData,
				});

				if (!uploadRes.ok) {
					const err = await uploadRes.json();
					throw new Error(err.error || `Failed to upload ${pdf.displayName}`);
				}

				const { stagingKey, fileSize } = await uploadRes.json();

				setCurrentlyUploading((prev) => {
					const updated = [...prev];
					updated[i] = { name: pdf.displayName, percent: 100 };
					return updated;
				});

				uploadedFiles.push({
					fileName: pdf.displayName,
					stagingKey,
					pageCount: pdf.getPages(),
					copies: pdf.getQuantity(),
					colorMode: pdf.isColor ? "COLOR" : "BW",
					fileSize: fileSize || pdf.file.size,
				});
			}

			// Step 2: Create the order in Payload (pricing calculated server-side)
			const orderRes = await fetch("/api/shop/orders", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					files: uploadedFiles,
				}),
			});

			if (!orderRes.ok) {
				const err = await orderRes.json();
				throw new Error(err.error || "Failed to create order.");
			}

			const { order } = await orderRes.json();

			setIsProcessing(false);
			setCurrentlyUploading([]);
			onProceedToPayment(order.id, order.orderNumber);
		} catch (error) {
			setIsProcessing(false);
			setCurrentlyUploading([]);
			setIsCreatingOrder(false);
			window.alert(
				error instanceof Error ? error.message : "Something went wrong.",
			);
		}
	}, [
		uploadedPdfs,
		cartPackages,
		cartPackages.length,
		isAuthenticated,
		login,
		onProceedToPayment,
		setIsProcessing,
		setCurrentlyUploading,
	]);

	return (
		<Box
			w="100%"
			bg="white"
			h="fit-content"
			position={smallScreen ? "relative" : "sticky"}
			padding="1rem .5rem"
			border="1px"
			borderRadius="8px"
			color="brown.900"
			borderColor="brown.200"
			top={smallScreen ? "0" : "5rem"}
		>
			<Box display="flex" flexDir="column">
				<Heading fontSize="1.5rem" as="p">
					🛒 Your Items
				</Heading>
				<p>
					click the <strong>X</strong> on the right of an item to remove
				</p>
				<List>
					<Divider marginBottom=".5rem" />
					<CartItemContainer />
					<PdfItemContainer />
					<ListItem>
						<Text fontSize="1.5rem">
							<strong>Estimated Price: ${displayPriceString}</strong>
						</Text>
					</ListItem>

					{/* Auth-aware order button */}
					{authLoading ? (
						<Button variant="browned" isDisabled>
							<Spinner size="sm" mr={2} /> Loading…
						</Button>
					) : isAuthenticated ? (
						<Button
							variant="browned"
							onClick={handleOrderNow}
							isLoading={isCreatingOrder}
							loadingText="Creating order…"
						>
							Proceed to Payment
						</Button>
					) : (
						<Box display="flex" flexDir="column" gap={2}>
							<Button variant="browned" onClick={login}>
								Sign in to Order
							</Button>
							<Text fontSize="xs" color="gray.500" textAlign="center">
								Sign in with Google to proceed with your order
							</Text>
						</Box>
					)}
				</List>
			</Box>
		</Box>
	);
};

export default Cart;
