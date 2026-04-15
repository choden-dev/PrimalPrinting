"use client";

import { Box, Button, Divider, Heading, Text } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { OrderStatus } from "../../types/orderStatus";
import { OrderStep } from "../../types/orderSteps";
import { BankTransferForm } from "../payment/BankTransferForm";
import { StripePaymentForm } from "../payment/StripePaymentForm";
import { TimeslotSelector } from "../pickup/TimeslotSelector";

interface OrderStepsProps {
	step:
		| typeof OrderStep.PAYMENT
		| typeof OrderStep.PICKUP
		| typeof OrderStep.COMPLETE;
	orderId: string;
	orderNumber: string;
	onPaymentSuccess: () => void;
	onPickupConfirmed: () => void;
}

interface OrderDetails {
	id: string;
	orderNumber: string;
	status: string;
	pricing: { subtotal: number; tax: number; total: number };
	files: {
		fileName: string;
		copies: number;
		colorMode: string;
		pageCount: number;
	}[];
}

/**
 * Multi-step order flow shown after the user has configured their order
 * and is authenticated.
 *
 * Steps:
 * 1. Payment — choose Stripe or bank transfer
 * 2. Pickup — select a timeslot
 * 3. Complete — confirmation screen
 */
export default function OrderSteps({
	step,
	orderId,
	orderNumber,
	onPaymentSuccess,
	onPickupConfirmed,
}: OrderStepsProps) {
	const { email } = useAuth();
	const router = useRouter();
	const [paymentMethod, setPaymentMethod] = useState<"stripe" | "bank" | null>(
		null,
	);
	const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
	const [pollForPayment, setPollForPayment] = useState(false);
	const [waitingForStripe, setWaitingForStripe] = useState(false);

	// Fetch order details
	useEffect(() => {
		async function fetchOrder() {
			try {
				const res = await fetch(`/api/shop/${orderId}`);
				if (res.ok) {
					const data = await res.json();
					setOrderDetails(data.order);

					// If order is already PAID, jump to pickup
					if (
						data.order.status === OrderStatus.PAID &&
						step === OrderStep.PAYMENT
					) {
						onPaymentSuccess();
					}
					// If already has a timeslot, jump to complete
					if (
						[
							OrderStatus.AWAITING_PICKUP,
							OrderStatus.PRINTED,
							OrderStatus.PICKED_UP,
						].includes(data.order.status) &&
						step !== OrderStep.COMPLETE
					) {
						onPickupConfirmed();
					}
				}
			} catch (err) {
				console.error("Failed to fetch order:", err);
			}
		}
		fetchOrder();
	}, [orderId, step, onPaymentSuccess, onPickupConfirmed]);

	// Poll for payment status (after Stripe confirmation or bank transfer submission)
	useEffect(() => {
		if (!pollForPayment) return;
		const interval = setInterval(async () => {
			try {
				const res = await fetch(`/api/shop/${orderId}`);
				if (res.ok) {
					const data = await res.json();
					if (data.order.status === OrderStatus.PAID) {
						clearInterval(interval);
						setWaitingForStripe(false);
						onPaymentSuccess();
					}
				}
			} catch {
				// ignore polling errors
			}
		}, 2000);
		return () => clearInterval(interval);
	}, [pollForPayment, orderId, onPaymentSuccess]);

	const totalCents = orderDetails?.pricing?.total || 0;

	// ── Order summary (reused across steps) ────────────────────────

	const OrderSummary = () => {
		if (!orderDetails?.files?.length) return null;
		return (
			<Box bg="gray.50" borderRadius="8px" padding="0.75rem 1rem" mb={4}>
				<Text fontSize="sm" fontWeight={600} mb={2}>
					📋 Order Summary
				</Text>
				{orderDetails.files.map((file, i) => (
					<Box
						key={`${file.fileName}-${i}`}
						display="flex"
						justifyContent="space-between"
						alignItems="center"
						py={1}
						fontSize="sm"
					>
						<Text>📄 {file.fileName}</Text>
						<Text color="gray.500">
							{file.pageCount} pg · {file.copies}x ·{" "}
							{file.colorMode === "COLOR" ? "Colour" : "B&W"}
						</Text>
					</Box>
				))}
				<Divider my={2} />
				<Box display="flex" justifyContent="space-between" fontWeight={700}>
					<Text>Total</Text>
					<Text>${(totalCents / 100).toFixed(2)}</Text>
				</Box>
			</Box>
		);
	};

	const containerProps = {
		maxWidth: "900px",
		margin: "2rem auto",
		bg: "white",
		p: 6,
		borderRadius: "8px",
		minHeight: "500px",
	};

	// ── Step indicator ─────────────────────────────────────────────

	const StepIndicator = () => (
		<Box
			display="flex"
			justifyContent="center"
			gap="0.5rem"
			mb={6}
			flexWrap="wrap"
		>
			{[
				{ key: OrderStep.UPLOAD, label: "Upload" },
				{ key: OrderStep.PAYMENT, label: "Payment" },
				{ key: OrderStep.PICKUP, label: "Pickup" },
				{ key: OrderStep.COMPLETE, label: "Done" },
			].map((s) => {
				const isCurrent = s.key === step;
				const isPast =
					s.key === OrderStep.UPLOAD ||
					(s.key === OrderStep.PAYMENT &&
						([OrderStep.PICKUP, OrderStep.COMPLETE] as string[]).includes(
							step,
						)) ||
					(s.key === OrderStep.PICKUP && step === OrderStep.COMPLETE);
				return (
					<Box
						key={s.key}
						px={4}
						py={2}
						borderRadius="full"
						fontSize="sm"
						fontWeight={isCurrent ? 700 : 500}
						bg={isCurrent ? "brown.700" : isPast ? "green.100" : "gray.100"}
						color={isCurrent ? "white" : isPast ? "green.800" : "gray.500"}
					>
						{isPast ? `✓ ${s.label}` : s.label}
					</Box>
				);
			})}
		</Box>
	);

	// ── Payment step ───────────────────────────────────────────────

	if (step === OrderStep.PAYMENT) {
		return (
			<Box {...containerProps}>
				<StepIndicator />
				<Heading size="lg" mb={2}>
					💳 Payment
				</Heading>
				<Text color="gray.600" mb={4}>
					Order: <strong>{orderNumber}</strong>
				</Text>
				<OrderSummary />
				<Divider mb={6} />

				{!paymentMethod ? (
					<Box display="flex" flexDir="column" gap={4}>
						<Text fontSize="lg" fontWeight={600} mb={2}>
							💰 Choose a payment method
						</Text>
						<Button
							size="lg"
							variant="outline"
							borderColor="brown.700"
							color="brown.900"
							_hover={{ bg: "brown.50" }}
							onClick={() => setPaymentMethod("stripe")}
							h="auto"
							py={4}
							display="flex"
							flexDir="column"
							alignItems="flex-start"
						>
							<Text fontWeight={700}>💳 Credit / Debit Card</Text>
							<Text fontSize="sm" fontWeight={400} color="gray.500">
								Pay instantly with Stripe — no redirect
							</Text>
						</Button>
						<Button
							size="lg"
							variant="outline"
							borderColor="brown.700"
							color="brown.900"
							_hover={{ bg: "brown.50" }}
							onClick={() => setPaymentMethod("bank")}
							h="auto"
							py={4}
							display="flex"
							flexDir="column"
							alignItems="flex-start"
						>
							<Text fontWeight={700}>🏦 Bank Transfer</Text>
							<Text fontSize="sm" fontWeight={400} color="gray.500">
								Transfer & upload proof — verified by admin
							</Text>
						</Button>
					</Box>
				) : paymentMethod === "stripe" ? (
					<Box>
						<Button
							variant="ghost"
							size="sm"
							mb={4}
							onClick={() => setPaymentMethod(null)}
						>
							← Back to payment options
						</Button>
						{waitingForStripe ? (
							<Box textAlign="center" py={8}>
								<Text fontSize="lg" fontWeight={600} color="green.600" mb={2}>
									✅ Payment received!
								</Text>
								<Text color="gray.500" mb={4}>
									Confirming your order — this will only take a moment…
								</Text>
								<Box
									display="inline-block"
									w="24px"
									h="24px"
									border="3px solid"
									borderColor="green.200"
									borderTopColor="green.600"
									borderRadius="50%"
									animation="spin 0.8s linear infinite"
									sx={{
										"@keyframes spin": { to: { transform: "rotate(360deg)" } },
									}}
								/>
							</Box>
						) : (
							<StripePaymentForm
								orderId={orderId}
								totalCents={totalCents}
								onSuccess={() => {
									setWaitingForStripe(true);
									setPollForPayment(true);
								}}
								onError={(err) => console.error("Stripe error:", err)}
							/>
						)}
					</Box>
				) : (
					<Box>
						<Button
							variant="ghost"
							size="sm"
							mb={4}
							onClick={() => setPaymentMethod(null)}
						>
							← Back to payment options
						</Button>
						<BankTransferForm
							orderId={orderId}
							orderNumber={orderNumber}
							totalCents={totalCents}
							onSuccess={() => {
								setPollForPayment(true);
							}}
							onError={(err) => console.error("Bank transfer error:", err)}
						/>
						{pollForPayment && (
							<Box
								mt={6}
								p={4}
								bg="orange.50"
								borderRadius="8px"
								textAlign="center"
							>
								<Text fontWeight={600} color="orange.700">
									⏳ Proof submitted! Waiting for admin verification…
								</Text>
								<Text fontSize="sm" color="gray.600" mt={2}>
									You&apos;ll be redirected automatically once verified, or you
									can check back later from{" "}
									<Button
										variant="link"
										colorScheme="blue"
										size="sm"
										onClick={() => router.push("/my-orders")}
									>
										My Orders
									</Button>
									.
								</Text>
							</Box>
						)}
					</Box>
				)}
			</Box>
		);
	}

	// ── Pickup step ────────────────────────────────────────────────

	if (step === OrderStep.PICKUP) {
		return (
			<Box {...containerProps}>
				<StepIndicator />
				<Heading size="lg" mb={2}>
					📍 Select Pickup Time
				</Heading>
				<Text color="gray.600" mb={4}>
					Order <strong>{orderNumber}</strong> has been paid. Choose when
					you&apos;d like to collect it.
				</Text>
				<OrderSummary />
				<Divider mb={6} />
				<TimeslotSelector
					orderId={orderId}
					onSuccess={() => onPickupConfirmed()}
					onError={(err) => console.error("Timeslot error:", err)}
				/>
			</Box>
		);
	}

	// ── Complete step ──────────────────────────────────────────────

	if (step === OrderStep.COMPLETE) {
		return (
			<Box {...containerProps} textAlign="center">
				<StepIndicator />
				<Heading size="lg" mb={2}>
					🎉 Order Confirmed!
				</Heading>
				<Text color="gray.600" mb={4}>
					Your order <strong>{orderNumber}</strong> is confirmed.
				</Text>
				<Text color="gray.600" mb={6}>
					A confirmation email has been sent to <strong>{email}</strong> with
					your order details and pickup information.
				</Text>
				<Divider mb={6} />

				{orderDetails && (
					<Box textAlign="left" mb={6}>
						<Heading size="sm" mb={3}>
							Order Summary
						</Heading>
						{orderDetails.files?.map((file, i) => (
							<Box
								key={`${file.fileName}-${i}`}
								p={3}
								bg="gray.50"
								borderRadius="6px"
								mb={2}
								fontSize="sm"
							>
								<Text fontWeight={600}>{file.fileName}</Text>
								<Text color="gray.600">
									{file.pageCount} pages · {file.copies}{" "}
									{file.copies === 1 ? "copy" : "copies"} ·{" "}
									{file.colorMode === "COLOR" ? "Colour" : "B&W"}
								</Text>
							</Box>
						))}
						<Divider my={3} />
						<Text fontWeight={700} fontSize="lg">
							Total: ${(totalCents / 100).toFixed(2)}
						</Text>
					</Box>
				)}

				<Box display="flex" gap={4} justifyContent="center" flexWrap="wrap">
					<Button colorScheme="blue" onClick={() => router.push("/my-orders")}>
						View My Orders
					</Button>
					<Button variant="outline" onClick={() => router.push("/")}>
						Back to Home
					</Button>
				</Box>
			</Box>
		);
	}

	return null;
}
