import {
	Box,
	Tab,
	TabList,
	TabPanel,
	TabPanels,
	Tabs,
	useMediaQuery,
} from "@chakra-ui/react";
import { useState } from "react";
import { CartContextProvider } from "../../contexts/CartContext";
import type { StripeBackendItem } from "../../types/types";
import Footer from "../footer/Footer";
import ProcessingOverlay from "../processingoverlay/ProcessingOverlay";
import Cart from "./Cart";
import ExtraInfo from "./ExtraInfo";
import OrderSteps from "./OrderSteps";
import PackageOrder from "./PackageOrder";
import PdfOrder from "./PdfOrder";

type Props = {
	packages: StripeBackendItem[];
};

const OrderContainer = ({ packages }: Props) => {
	return (
		<CartContextProvider>
			<OrderContainerInner packages={packages} />
		</CartContextProvider>
	);
};

const OrderContainerInner = ({ packages }: Props) => {
	const [isProcessing, setIsProcessing] = useState(false);
	const [currentlyUploading, setCurrentlyUploading] = useState<
		{ name: string; percent: number }[]
	>([]);
	const [smallScreen] = useMediaQuery(`(max-width: 1000px)`);

	// Track the current step of the new order flow
	// "configure" → "payment" → "pickup" → "complete"
	const [orderStep, setOrderStep] = useState<
		"configure" | "payment" | "pickup" | "complete"
	>("configure");
	const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
	const [activeOrderNumber, setActiveOrderNumber] = useState<string | null>(
		null,
	);

	// After order is created and user is authenticated → move to payment
	const handleProceedToPayment = (orderId: string, orderNumber: string) => {
		setActiveOrderId(orderId);
		setActiveOrderNumber(orderNumber);
		setOrderStep("payment");
	};

	// After payment confirmed → move to pickup selection
	const handlePaymentSuccess = () => {
		setOrderStep("pickup");
	};

	// After pickup selected → show completion
	const handlePickupConfirmed = () => {
		setOrderStep("complete");
	};

	// Show the step-based flow once we're past the configuration stage
	if (orderStep !== "configure") {
		return (
			<>
				<ProcessingOverlay show={isProcessing} items={currentlyUploading} />
				<OrderSteps
					step={orderStep}
					orderId={activeOrderId || ""}
					orderNumber={activeOrderNumber || ""}
					onPaymentSuccess={handlePaymentSuccess}
					onPickupConfirmed={handlePickupConfirmed}
				/>
				<Footer />
			</>
		);
	}

	return (
		<>
			<ProcessingOverlay show={isProcessing} items={currentlyUploading} />
			<ExtraInfo />
			<Box
				paddingTop="1rem"
				display="grid"
				columnGap="1rem"
				rowGap="1rem"
				gridTemplateColumns={smallScreen ? "1fr" : "3fr 1.5fr"}
			>
				<Box
					border="1px"
					borderColor="brown.200"
					bg="white"
					padding="1rem"
					position="relative"
					overflowX="visible"
				>
					<Box
						position="absolute"
						top="0"
						left="-2rem"
						h="100%"
						w="2.8rem"
						overflowY="hidden"
						backgroundImage="/binder.png"
					/>
					<Tabs variant="enclosed" colorScheme="brown">
						<TabList padding="0 1rem">
							{false && <Tab fontWeight="700">Order Packages</Tab>}
							<Tab fontWeight="700">Upload Pdf</Tab>
						</TabList>
						<TabPanels>
							{false && (
								<TabPanel>
									<PackageOrder
										displayPackages={packages}
										smallScreen={smallScreen}
									/>
								</TabPanel>
							)}
							<TabPanel>
								<PdfOrder />
							</TabPanel>
						</TabPanels>
					</Tabs>
				</Box>
				<Cart
					smallScreen={smallScreen}
					onProceedToPayment={handleProceedToPayment}
					setIsProcessing={setIsProcessing}
					setCurrentlyUploading={setCurrentlyUploading}
				/>
			</Box>
			<Footer />
		</>
	);
};

export default OrderContainer;
