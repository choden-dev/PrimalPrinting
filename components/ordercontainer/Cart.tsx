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
import {
	requestPresignedUrls,
	uploadFilesWithProgress,
} from "../../lib/uploadClient";
import {
	MAX_FILE_SIZE_BYTES,
	MAX_FILE_SIZE_MB,
	MAX_FILES_PER_ORDER,
} from "../../lib/uploadLimits";
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
	const { cartPackages, uploadedPdfs, displayPriceString, persistCart } =
		useContext(CartContext);
	const { isAuthenticated, isLoading: authLoading, login } = useAuth();
	const [isCreatingOrder, setIsCreatingOrder] = useState(false);

	/**
	 * Upload all PDFs to R2 via presigned PUT URLs (with real per-file
	 * progress), then call /api/shop/orders to finalise the DRAFT order.
	 *
	 * The bytes never traverse our server — the browser PUTs straight to R2.
	 * This avoids the Cloudflare Worker / Container body-size limits that
	 * caused the original "Failed to parse body as FormData" failures, and
	 * lets us show real upload progress via XHR.upload.onprogress.
	 *
	 * Client-side validation mirrors the server limits so customers get
	 * instant, descriptive errors before any bytes leave their machine.
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
			// Persist uploaded files to IndexedDB before redirecting for OAuth
			await persistCart();
			login();
			return;
		}

		// ── Client-side validation ─────────────────────────────────────────
		// Limits are imported from lib/uploadLimits.ts so client + server can
		// never drift apart.
		if (uploadedPdfs.length > MAX_FILES_PER_ORDER) {
			window.alert(
				`You've added ${uploadedPdfs.length} files. The maximum is ${MAX_FILES_PER_ORDER} per order. Please remove some files and try again.`,
			);
			return;
		}

		const oversized = uploadedPdfs.find(
			(pdf) => pdf.file.size > MAX_FILE_SIZE_BYTES,
		);
		if (oversized) {
			const mb = (oversized.file.size / 1024 / 1024).toFixed(1);
			window.alert(
				`"${oversized.displayName}" is ${mb}MB, which exceeds the ${MAX_FILE_SIZE_MB}MB per-file limit. Please compress or split the PDF and try again.`,
			);
			return;
		}

		const wrongType = uploadedPdfs.find(
			(pdf) => pdf.file.type && pdf.file.type !== "application/pdf",
		);
		if (wrongType) {
			window.alert(
				`"${wrongType.displayName}" is not a PDF (${wrongType.file.type}). Only PDF files are accepted.`,
			);
			return;
		}

		const empty = uploadedPdfs.find((pdf) => pdf.file.size === 0);
		if (empty) {
			window.alert(
				`"${empty.displayName}" is empty (0 bytes). Please re-add the file and try again.`,
			);
			return;
		}

		setIsCreatingOrder(true);
		setIsProcessing(true);
		setCurrentlyUploading(
			uploadedPdfs.map((pdf) => ({ name: pdf.displayName, percent: 0 })),
		);

		try {
			// Step 1: Ask the server for presigned PUT URLs for each file.
			const filesToUpload = uploadedPdfs.map((pdf) => ({
				file: pdf.file,
				displayName: pdf.displayName,
			}));
			const uploads = await requestPresignedUrls(filesToUpload);

			// Step 2: PUT each file directly to R2 with real progress events.
			//   - Concurrency 3 keeps the customer's connection responsive
			//     while still parallelising for speed.
			//   - 1 automatic retry recovers from transient network blips.
			const uploaded = await uploadFilesWithProgress({
				files: filesToUpload,
				uploads,
				concurrency: 3,
				retries: 1,
				onProgress: ({ displayName, percent }) => {
					setCurrentlyUploading((prev) =>
						prev.map((p) => (p.name === displayName ? { ...p, percent } : p)),
					);
				},
			});

			// Step 3: Finalise the order with the server. Tiny JSON payload —
			// no multipart, no body-size concerns.
			const finaliseBody = {
				files: uploaded.map((u, i) => ({
					stagingKey: u.stagingKey,
					fileName: u.file.file.name,
					copies: uploadedPdfs[i].getQuantity(),
					colorMode: uploadedPdfs[i].isColor ? "COLOR" : "BW",
				})),
			};

			let orderRes: Response;
			try {
				orderRes = await fetch("/api/shop/orders", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(finaliseBody),
				});
			} catch (networkErr) {
				throw new Error(
					`Could not reach the server to finalise the order — your connection may have dropped. Please try again. (${
						networkErr instanceof Error ? networkErr.message : "network error"
					})`,
				);
			}

			if (!orderRes.ok) {
				let serverMessage = `Failed to create order (HTTP ${orderRes.status}).`;
				try {
					const err = await orderRes.json();
					if (err?.error) serverMessage = err.error;
				} catch {
					// Response body wasn't JSON — keep the HTTP-status message.
				}
				throw new Error(serverMessage);
			}

			const { order } = await orderRes.json();

			setCurrentlyUploading(
				uploadedPdfs.map((pdf) => ({ name: pdf.displayName, percent: 100 })),
			);

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
		persistCart,
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
							<Button
								variant="browned"
								onClick={async () => {
									await persistCart();
									login();
								}}
							>
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
