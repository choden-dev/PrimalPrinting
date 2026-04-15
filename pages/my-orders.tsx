import {
	Badge,
	Box,
	Button,
	Divider,
	Heading,
	Spinner,
	Table,
	Tbody,
	Td,
	Text,
	Th,
	Thead,
	Tr,
} from "@chakra-ui/react";
import type { NextPage } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import Footer from "../components/footer/Footer";
import NavBar from "../components/navbar/NavBar";
import { useAuth } from "../contexts/AuthContext";

interface OrderFile {
	fileName: string;
	pageCount: number;
	copies: number;
	colorMode: string;
	paperSize: string;
}

interface Order {
	id: string;
	orderNumber: string;
	status: string;
	paymentMethod: string | null;
	files: OrderFile[];
	pricing: { subtotal: number; tax: number; total: number };
	pickupTimeslot: {
		date: string;
		startTime: string;
		endTime: string;
		label: string;
	} | null;
	expiresAt: string | null;
	paidAt: string | null;
	pickedUpAt: string | null;
	createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
	DRAFT: "gray",
	AWAITING_PAYMENT: "orange",
	PAYMENT_PENDING_VERIFICATION: "yellow",
	PAID: "green",
	AWAITING_PICKUP: "blue",
	READY_FOR_PICKUP: "purple",
	PICKED_UP: "teal",
	EXPIRED: "red",
};

const STATUS_LABELS: Record<string, string> = {
	DRAFT: "Draft",
	AWAITING_PAYMENT: "Awaiting Payment",
	PAYMENT_PENDING_VERIFICATION: "Pending Verification",
	PAID: "Paid",
	AWAITING_PICKUP: "Awaiting Pickup",
	READY_FOR_PICKUP: "Ready for Pickup",
	PICKED_UP: "Picked Up",
	EXPIRED: "Expired",
};

const MyOrders: NextPage = () => {
	const { isAuthenticated, isLoading: authLoading, login, name } = useAuth();
	const router = useRouter();
	const [orders, setOrders] = useState<Order[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchOrders = useCallback(async () => {
		try {
			setLoading(true);
			const res = await fetch("/api/orders/my-orders");
			if (!res.ok) throw new Error("Failed to fetch orders.");
			const data = await res.json();
			setOrders(data.orders || []);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load orders.");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (isAuthenticated) fetchOrders();
	}, [isAuthenticated, fetchOrders]);

	// Show login prompt if not authenticated
	if (!authLoading && !isAuthenticated) {
		return (
			<>
				<Head>
					<title>My Orders - Primal Printing</title>
				</Head>
				<Box className="container">
					<NavBar />
					<Box
						maxWidth="600px"
						margin="2rem auto"
						bg="white"
						padding="2rem"
						borderRadius="8px"
						textAlign="center"
					>
						<Heading size="lg" mb={4}>
							Sign in to view your orders
						</Heading>
						<Text mb={6} color="gray.600">
							Sign in with your Google account to view your order history, track
							current orders, and manage pickups.
						</Text>
						<Button colorScheme="blue" size="lg" onClick={login}>
							Sign in with Google
						</Button>
					</Box>
					<Footer />
				</Box>
			</>
		);
	}

	return (
		<>
			<Head>
				<title>My Orders - Primal Printing</title>
			</Head>
			<Box className="container">
				<NavBar />
				<Box
					maxWidth="1100px"
					margin="2rem auto"
					bg="white"
					padding="1.5rem"
					borderRadius="8px"
				>
					<Heading size="lg" mb={2}>
						My Orders
					</Heading>
					{name && (
						<Text color="gray.500" mb={4}>
							Welcome back, {name}
						</Text>
					)}
					<Divider mb={6} />

					{authLoading || loading ? (
						<Box textAlign="center" py={8}>
							<Spinner size="lg" />
							<Text mt={4} color="gray.500">
								Loading your orders…
							</Text>
						</Box>
					) : error ? (
						<Box bg="red.50" p={4} borderRadius="8px" color="red.600">
							{error}
						</Box>
					) : orders.length === 0 ? (
						<Box textAlign="center" py={8}>
							<Text fontSize="lg" color="gray.500" mb={4}>
								You haven&apos;t placed any orders yet.
							</Text>
							<Button colorScheme="blue" onClick={() => router.push("/order")}>
								Place an Order
							</Button>
						</Box>
					) : (
						<Box overflowX="auto">
							<Table variant="simple" size="sm">
								<Thead>
									<Tr>
										<Th>Order #</Th>
										<Th>Status</Th>
										<Th>Items</Th>
										<Th isNumeric>Total</Th>
										<Th>Pickup</Th>
										<Th>Date</Th>
										<Th />
									</Tr>
								</Thead>
								<Tbody>
									{orders.map((order) => (
										<Tr key={order.id}>
											<Td fontWeight="600" fontFamily="mono">
												{order.orderNumber}
											</Td>
											<Td>
												<Badge
													colorScheme={STATUS_COLORS[order.status] || "gray"}
													fontSize="xs"
												>
													{STATUS_LABELS[order.status] || order.status}
												</Badge>
											</Td>
											<Td>
												{order.files?.length || 0} file
												{(order.files?.length || 0) !== 1 ? "s" : ""}
											</Td>
											<Td isNumeric fontWeight="600">
												${((order.pricing?.total || 0) / 100).toFixed(2)}
											</Td>
											<Td fontSize="sm">
												{order.pickupTimeslot
													? `${new Date(order.pickupTimeslot.date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })} ${order.pickupTimeslot.startTime}`
													: "—"}
											</Td>
											<Td fontSize="sm" color="gray.500">
												{new Date(order.createdAt).toLocaleDateString("en-AU")}
											</Td>
											<Td>
												{(order.status === "DRAFT" ||
													order.status === "AWAITING_PAYMENT") && (
													<Button
														size="xs"
														colorScheme="blue"
														onClick={() =>
															router.push(`/order?resume=${order.id}`)
														}
													>
														Continue
													</Button>
												)}
												{order.status === "PAID" && (
													<Button
														size="xs"
														colorScheme="green"
														onClick={() =>
															router.push(`/order?pickupFor=${order.id}`)
														}
													>
														Select Pickup
													</Button>
												)}
											</Td>
										</Tr>
									))}
								</Tbody>
							</Table>
						</Box>
					)}
				</Box>
				<Footer />
			</Box>
		</>
	);
};

export default MyOrders;
