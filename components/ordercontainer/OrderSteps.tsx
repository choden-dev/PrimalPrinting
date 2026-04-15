"use client";

import { Box, Button, Divider, Heading, Text } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { BankTransferForm } from "../payment/BankTransferForm";
import { StripePaymentForm } from "../payment/StripePaymentForm";
import { TimeslotSelector } from "../pickup/TimeslotSelector";

interface OrderStepsProps {
	step: "payment" | "pickup" | "complete";
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
		paperSize: string;
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

	// Fetch order details
	useEffect(() => {
		async function fetchOrder() {
			try {
				const res = await fetch(`/api/orders/${orderId}`);
				if (res.ok) {
					const data = await res.json();
					setOrderDetails(data.order);

					// If order is already PAID, jump to pickup
					if (data.order.status === "PAID" && step === "payment") {
						onPaymentSuccess();
					}
					// If already has a timeslot, jump to complete
					if (
						["AWAITING_PICKUP", "READY_FOR_PICKUP", "PICKED_UP"].includes(
							data.order.status,
						) &&
						step !== "complete"
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

	// Poll for payment status after bank transfer submission
	useEffect(() => {
		if (!pollForPayment) return;
		const interval = setInterval(async () => {
			try {
				const res = await fetch(`/api/orders/${orderId}`);
				if (res.ok) {
					const data = await res.json();
					if (data.order.status === "PAID") {
						clearInterval(interval);
						onPaymentSuccess();
					}
				}
			} catch {
				// ignore polling errors
			}
		}, 5000);
		return () => clearInterval(interval);
	}, [pollForPayment, orderId, onPaymentSuccess]);

	const totalCents = orderDetails?.pricing?.total || 0;

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
				{ key: "configure", label: "1. Configure" },
				{ key: "payment", label: "2. Payment" },
				{ key: "pickup", label: "3. Pickup" },
				{ key: "complete", label: "4. Done" },
			].map((s) => {
				const isCurrent = s.key === step;
				const isPast =
					["configure"].includes(s.key) ||
					(s.key === "payment" && ["pickup", "complete"].includes(step)) ||
					(s.key === "pickup" && step === "complete");
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

	if (step === "payment") {
		return (
			<Box
				maxWidth="700px"
				margin="2rem auto"
				bg="white"
				p={6}
				borderRadius="8px"
			>
				<StepIndicator />
				<Heading size="lg" mb={2}>
					Payment
				</Heading>
				<Text color="gray.600" mb={1}>
					Order: <strong>{orderNumber}</strong>
				</Text>
				<Text color="gray.600" mb={4}>
					Total: <strong>${(totalCents / 100).toFixed(2)}</strong>
				</Text>
				<Divider mb={6} />

				{!paymentMethod ? (
					<Box display="flex" flexDir="column" gap={4}>
						<Text fontSize="lg" fontWeight={600} mb={2}>
							Choose a payment method
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
						<StripePaymentForm
							orderId={orderId}
							totalCents={totalCents}
							onSuccess={() => onPaymentSuccess()}
							onError={(err) => console.error("Stripe error:", err)}
						/>
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

	if (step === "pickup") {
		return (
			<Box
				maxWidth="700px"
				margin="2rem auto"
				bg="white"
				p={6}
				borderRadius="8px"
			>
				<StepIndicator />
				<Heading size="lg" mb={2}>
					Select Pickup Time
				</Heading>
				<Text color="gray.600" mb={4}>
					Order <strong>{orderNumber}</strong> has been paid. Choose when
					you&apos;d like to collect it.
				</Text>
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

	if (step === "complete") {
		return (
			<Box
				maxWidth="700px"
				margin="2rem auto"
				bg="white"
				p={6}
				borderRadius="8px"
				textAlign="center"
			>
				<StepIndicator />
				<Box fontSize="4xl" mb={4}>
					🎉
				</Box>
				<Heading size="lg" mb={2}>
					Order Confirmed!
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
									{file.colorMode === "COLOR" ? "Colour" : "B&W"} ·{" "}
									{file.paperSize}
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
