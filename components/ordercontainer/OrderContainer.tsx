import {
	Box,
	Button,
	Spinner,
	Tab,
	TabList,
	TabPanel,
	TabPanels,
	Tabs,
	Text,
	useMediaQuery,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { CartContextProvider } from "@/contexts/CartContext";
import { OrderStatus } from "@/types/orderStatus";
import { OrderStep, type OrderStepValue } from "../../types/orderSteps";
import Footer from "../footer/Footer";
import ProcessingOverlay from "../processingoverlay/ProcessingOverlay";
import Cart from "./Cart";
import ExtraInfo from "./ExtraInfo";
import OrderSteps from "./OrderSteps";
import PdfOrder from "./PdfOrder";

type ContactInfoData = {
	email: string;
	phone: string;
};

type OrderContainerProps = {
	contactInfo: ContactInfoData;
};

const OrderContainer = ({ contactInfo }: OrderContainerProps) => {
	return (
		<CartContextProvider>
			<OrderContainerInner contactInfo={contactInfo} />
		</CartContextProvider>
	);
};

const OrderContainerInner = ({
	contactInfo,
}: {
	contactInfo: ContactInfoData;
}) => {
	const [isProcessing, setIsProcessing] = useState(false);
	const [currentlyUploading, setCurrentlyUploading] = useState<
		{ name: string; percent: number }[]
	>([]);
	const [smallScreen] = useMediaQuery(`(max-width: 1000px)`);

	// Track the current step of the new order flow
	// UPLOAD → PAYMENT → PICKUP → COMPLETE
	const [orderStep, setOrderStep] = useState<OrderStepValue>(OrderStep.UPLOAD);
	const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
	const [activeOrderNumber, setActiveOrderNumber] = useState<string | null>(
		null,
	);
	const [resumeChecked, setResumeChecked] = useState(false);
	const [pendingOrders, setPendingOrders] = useState<
		{
			id: string;
			orderNumber: string;
			status: string;
			createdAt: string;
			pricing: { total: number };
			files: { fileName: string }[];
		}[]
	>([]);
	const { isAuthenticated } = useAuth();

	const router = useRouter();
	const resumeOrderId = router.query.resume as string | undefined;
	const pickupForOrderId = router.query.pickupFor as string | undefined;

	// Determine the correct step for a resumed order based on its status
	const statusToStep = useCallback((status: string): OrderStepValue => {
		switch (status) {
			case OrderStatus.DRAFT:
			case OrderStatus.AWAITING_PAYMENT:
				return OrderStep.PAYMENT;
			case OrderStatus.PAID:
				return OrderStep.PICKUP;
			case OrderStatus.AWAITING_PICKUP:
			case OrderStatus.PRINTED:
			case OrderStatus.PICKED_UP:
				return OrderStep.COMPLETE;
			default:
				return OrderStep.UPLOAD;
		}
	}, []);

	// Resume an existing order or jump to pickup selection
	useEffect(() => {
		const orderIdToResume = resumeOrderId || pickupForOrderId;
		if (!orderIdToResume || resumeChecked) return;

		async function resumeOrder() {
			try {
				const res = await fetch(`/api/shop/${orderIdToResume}`);
				if (!res.ok) {
					setResumeChecked(true);
					return;
				}
				const data = await res.json();
				const order = data.order;

				if (!order?.status) {
					setResumeChecked(true);
					return;
				}

				if (order.status === OrderStatus.EXPIRED) {
					// Can't resume expired orders
					setResumeChecked(true);
					return;
				}

				setActiveOrderId(order.id);
				setActiveOrderNumber(order.orderNumber);

				// If pickupFor query param, force pickup step (if order is PAID or AWAITING_PICKUP)
				if (
					pickupForOrderId &&
					(order.status === OrderStatus.PAID ||
						order.status === OrderStatus.AWAITING_PICKUP)
				) {
					setOrderStep(OrderStep.PICKUP);
				} else {
					setOrderStep(statusToStep(order.status));
				}
			} catch {
				// Silently fail — just show the configure step
			} finally {
				setResumeChecked(true);
			}
		}

		resumeOrder();
	}, [resumeOrderId, pickupForOrderId, resumeChecked, statusToStep]);

	// Fetch any in-progress orders for authenticated users
	useEffect(() => {
		if (!isAuthenticated) return;

		async function fetchPendingOrders() {
			try {
				const res = await fetch("/api/shop/my-orders?limit=5");
				if (!res.ok) return;
				const data = await res.json();
				const pending = (data.orders || []).filter(
					(o: { status: string }) =>
						o.status === OrderStatus.DRAFT ||
						o.status === OrderStatus.AWAITING_PAYMENT ||
						o.status === OrderStatus.PAID ||
						o.status === OrderStatus.AWAITING_PICKUP,
				);
				setPendingOrders(pending);
			} catch {
				// Silently fail
			}
		}

		fetchPendingOrders();
	}, [isAuthenticated]);

	// After order is created and user is authenticated → move to payment
	const handleProceedToPayment = (orderId: string, orderNumber: string) => {
		setActiveOrderId(orderId);
		setActiveOrderNumber(orderNumber);
		setOrderStep(OrderStep.PAYMENT);
	};

	// After payment confirmed → move to pickup selection
	const handlePaymentSuccess = () => {
		setOrderStep(OrderStep.PICKUP);
	};

	// After pickup selected → show completion
	const handlePickupConfirmed = () => {
		setOrderStep(OrderStep.COMPLETE);
	};

	// Show loading spinner while resuming an order
	const isResuming = (resumeOrderId || pickupForOrderId) && !resumeChecked;

	let content: ReactNode;

	if (isResuming) {
		content = (
			<Box textAlign="center" py={16}>
				<Spinner size="xl" color="brown.700" />
				<Text mt={4} color="gray.500" fontSize="lg">
					⏳ Resuming your order…
				</Text>
			</Box>
		);
	} else if (orderStep !== OrderStep.UPLOAD) {
		// Show the step-based flow once we're past the upload stage
		content = (
			<>
				<ProcessingOverlay show={isProcessing} items={currentlyUploading} />
				<Box maxWidth="900px" margin="0 auto">
					<Button
						variant="ghost"
						size="sm"
						mt={4}
						onClick={() => {
							setOrderStep(OrderStep.UPLOAD);
							setActiveOrderId(null);
							setActiveOrderNumber(null);
							router.replace("/order", undefined, { shallow: true });
						}}
						leftIcon={<Text>←</Text>}
					>
						📄 Start a new order
					</Button>
				</Box>
				<OrderSteps
					step={orderStep}
					orderId={activeOrderId || ""}
					orderNumber={activeOrderNumber || ""}
					onPaymentSuccess={handlePaymentSuccess}
					onPickupConfirmed={handlePickupConfirmed}
				/>
			</>
		);
	} else {
		content = (
			<>
				<ProcessingOverlay show={isProcessing} items={currentlyUploading} />
				{pendingOrders.length > 0 && (
					<Box
						bg="blue.50"
						border="1px solid"
						borderColor="blue.200"
						borderRadius="8px"
						padding="0.75rem 1rem"
						marginTop="1rem"
						marginBottom="0.5rem"
					>
						<Text fontSize="sm" color="blue.800" mb={2} fontWeight={600}>
							📋 You have {pendingOrders.length} in-progress order
							{pendingOrders.length !== 1 ? "s" : ""}
						</Text>
						<Box display="flex" flexDir="column" gap={2}>
							{pendingOrders.map((o) => (
								<Box
									key={o.id}
									display="flex"
									alignItems="center"
									justifyContent="space-between"
									bg="white"
									borderRadius="6px"
									padding="0.5rem 0.75rem"
									flexWrap="wrap"
									gap={2}
								>
									<Box display="flex" alignItems="center" gap={2} fontSize="sm">
										<Text fontFamily="mono" fontWeight={600}>
											{o.orderNumber}
										</Text>
										<Text color="gray.500">
											{o.files?.length || 0} file
											{(o.files?.length || 0) !== 1 ? "s" : ""} · $
											{((o.pricing?.total || 0) / 100).toFixed(2)}
										</Text>
									</Box>
									<Box display="flex" gap={1}>
										<Button
											size="xs"
											colorScheme="blue"
											onClick={() =>
												router.push(
													o.status === OrderStatus.PAID ||
														o.status === OrderStatus.AWAITING_PICKUP
														? `/order?pickupFor=${o.id}`
														: `/order?resume=${o.id}`,
												)
											}
										>
											{o.status === OrderStatus.AWAITING_PICKUP
												? "Change Pickup"
												: o.status === OrderStatus.PAID
													? "Select Pickup"
													: "Resume"}
										</Button>
										{o.status !== OrderStatus.PAID &&
											o.status !== OrderStatus.AWAITING_PICKUP && (
											<Button
												size="xs"
												colorScheme="red"
												variant="ghost"
												onClick={async () => {
													if (
														!window.confirm(
															`Delete order ${o.orderNumber}? This cannot be undone.`,
														)
													)
														return;
													try {
														const res = await fetch(
															`/api/shop/${o.id}/delete`,
															{
																method: "DELETE",
															},
														);
														if (!res.ok) {
															const data = await res.json();
															throw new Error(
																data.error || "Failed to delete.",
															);
														}
														setPendingOrders((prev) =>
															prev.filter((p) => p.id !== o.id),
														);
													} catch (err) {
														window.alert(
															err instanceof Error
																? err.message
																: "Failed to delete order.",
														);
													}
												}}
											>
												Delete
											</Button>
										)}
									</Box>
								</Box>
							))}
						</Box>
					</Box>
				)}
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
						borderRadius="8px"
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
								<Tab fontWeight="700">Upload PDF</Tab>
							</TabList>
							<TabPanels>
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
			</>
		);
	}

	return (
		<>
			{content}
			<Footer contactInfo={contactInfo} />
		</>
	);
};

export default OrderContainer;
