import { Box, Button, Divider, Heading, Spinner, Text } from "@chakra-ui/react";
import type { NextPage } from "next";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Footer from "../components/footer/Footer";
import NoSsr from "../components/NoSsr";
import NavBar from "../components/navbar/NavBar";

interface OrderDetails {
	orderNumber: string;
	status: string;
	pricing: { subtotal: number; tax: number; total: number };
	files: {
		fileName: string;
		pageCount: number;
		copies: number;
		colorMode: string;
		paperSize: string;
	}[];
	pickupTimeslot: {
		date: string;
		startTime: string;
		endTime: string;
		label: string;
	} | null;
}

/**
 * Order completion page.
 *
 * Displayed after a successful payment (Stripe redirect callback) or
 * when a user navigates here with an orderId query parameter.
 *
 * Fetches the order from the API and shows a confirmation summary.
 */
const OrderComplete: NextPage = () => {
	const router = useRouter();
	const orderId = router.query.orderId as string | undefined;
	const [order, setOrder] = useState<OrderDetails | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!orderId) return;

		async function fetchOrder() {
			try {
				const res = await fetch(`/api/orders/${orderId}`);
				if (!res.ok) throw new Error("Failed to load order.");
				const data = await res.json();
				setOrder(data.order);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to load order.");
			} finally {
				setLoading(false);
			}
		}
		fetchOrder();
	}, [orderId]);

	return (
		<NoSsr>
			<Box className="container">
				<NavBar />
				<Box
					justifySelf="center"
					marginTop="2rem"
					maxWidth="700px"
					margin="2rem auto"
					bg="white"
					display="flex"
					flexDir="column"
					padding="1.5rem"
					borderRadius="8px"
				>
					{loading ? (
						<Box textAlign="center" py={8}>
							<Spinner size="lg" />
							<Text mt={4} color="gray.500">
								Loading order details…
							</Text>
						</Box>
					) : error || !order ? (
						<Box textAlign="center" py={8}>
							<Heading size="md" color="red.500" mb={4}>
								{error || "Order not found"}
							</Heading>
							<Button onClick={() => router.push("/my-orders")}>
								View My Orders
							</Button>
						</Box>
					) : (
						<>
							<Box textAlign="center" mb={4}>
								<Text fontSize="4xl">🎉</Text>
								<Heading size="lg" mb={2}>
									Order Confirmed!
								</Heading>
								<Text color="gray.600">
									Order <strong>{order.orderNumber}</strong>
								</Text>
							</Box>

							<Divider mb={4} />

							<Heading size="sm" mb={3}>
								Order Items
							</Heading>
							{order.files?.map((file, i) => (
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

							<Divider my={4} />

							<Box
								display="flex"
								justifyContent="space-between"
								alignItems="center"
								mb={2}
							>
								<Text color="gray.600">Subtotal</Text>
								<Text>
									${((order.pricing?.subtotal || 0) / 100).toFixed(2)}
								</Text>
							</Box>
							<Box
								display="flex"
								justifyContent="space-between"
								alignItems="center"
								mb={2}
							>
								<Text color="gray.600">Tax (GST)</Text>
								<Text>${((order.pricing?.tax || 0) / 100).toFixed(2)}</Text>
							</Box>
							<Box
								display="flex"
								justifyContent="space-between"
								alignItems="center"
								mb={4}
							>
								<Text fontWeight={700} fontSize="lg">
									Total
								</Text>
								<Text fontWeight={700} fontSize="lg">
									${((order.pricing?.total || 0) / 100).toFixed(2)}
								</Text>
							</Box>

							{order.pickupTimeslot && (
								<>
									<Divider mb={4} />
									<Box
										p={4}
										bg="green.50"
										borderRadius="8px"
										borderLeft="4px solid"
										borderLeftColor="green.400"
									>
										<Heading size="sm" color="green.700" mb={2}>
											📍 Pickup Details
										</Heading>
										<Text>
											<strong>Date:</strong>{" "}
											{new Date(order.pickupTimeslot.date).toLocaleDateString(
												"en-AU",
												{
													weekday: "long",
													day: "numeric",
													month: "long",
													year: "numeric",
												},
											)}
										</Text>
										<Text>
											<strong>Time:</strong> {order.pickupTimeslot.startTime} –{" "}
											{order.pickupTimeslot.endTime}
										</Text>
									</Box>
								</>
							)}

							<Divider my={4} />

							<Text color="gray.500" fontSize="sm" textAlign="center" mb={4}>
								A confirmation email has been sent to your email address. Please
								check your spam folder if you don&apos;t see it.
							</Text>

							<Box
								display="flex"
								gap={4}
								justifyContent="center"
								flexWrap="wrap"
							>
								<Button
									colorScheme="blue"
									onClick={() => router.push("/my-orders")}
								>
									View My Orders
								</Button>
								<Button variant="outline" onClick={() => router.push("/")}>
									Back to Home
								</Button>
							</Box>
						</>
					)}
				</Box>
				<Footer />
			</Box>
		</NoSsr>
	);
};

export default OrderComplete;
