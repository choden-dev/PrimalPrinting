import {
	Badge,
	Box,
	Button,
	Divider,
	Heading,
	Spinner,
	Text,
} from "@chakra-ui/react";
import type { NextPage } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import Footer from "../components/footer/Footer";
import NavBar from "../components/navbar/NavBar";
import { useAuth } from "../contexts/AuthContext";
import {
	OrderStatus,
	type OrderStatusValue,
	RESUMABLE_STATUSES,
} from "../types/orderStatus";

interface Order {
	id: string;
	orderNumber: string;
	status: string;
	paymentMethod: string | null;
	files: { fileName: string; pageCount: number; copies: number }[];
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
	PAID: "green",
	AWAITING_PICKUP: "blue",
	PRINTED: "purple",
	PICKED_UP: "teal",
	EXPIRED: "red",
};

const STATUS_LABELS: Record<string, string> = {
	DRAFT: "Draft",
	AWAITING_PAYMENT: "Awaiting Payment",
	PAID: "Paid",
	AWAITING_PICKUP: "Awaiting Pickup",
	PRINTED: "Printed",
	PICKED_UP: "Picked Up",
	EXPIRED: "Expired",
};

const containerProps = {
	margin: { base: "1rem", md: "2rem auto" },
	maxWidth: { base: "100%", md: "900px" },
	bg: "white",
	padding: { base: "1rem", md: "1.5rem" },
	borderRadius: "8px",
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
			const res = await fetch("/api/shop/my-orders");
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
					<Box {...containerProps} textAlign="center">
						<Heading size="lg" mb={4}>
							🔑 Sign in to view your orders
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

	const renderOrderAction = (order: Order) => {
		if (RESUMABLE_STATUSES.includes(order.status as OrderStatusValue)) {
			return (
				<Button
					size="sm"
					colorScheme="blue"
					onClick={() => router.push(`/order?resume=${order.id}`)}
				>
					Continue
				</Button>
			);
		}
		if (order.status === OrderStatus.PAID) {
			return (
				<Button
					size="sm"
					colorScheme="green"
					onClick={() => router.push(`/order?pickupFor=${order.id}`)}
				>
					Select Pickup
				</Button>
			);
		}
		return null;
	};

	return (
		<>
			<Head>
				<title>My Orders - Primal Printing</title>
			</Head>
			<Box className="container">
				<NavBar />
				<Box {...containerProps}>
					<Box
						display="flex"
						justifyContent="space-between"
						alignItems="center"
						flexWrap="wrap"
						gap={2}
						mb={2}
					>
						<Box>
							<Heading size="lg">📦 My Orders</Heading>
							{name && (
								<Text color="gray.500" fontSize="sm">
									Welcome back, {name}
								</Text>
							)}
						</Box>
						<Button
							size="sm"
							colorScheme="blue"
							onClick={() => router.push("/order")}
						>
							New Order
						</Button>
					</Box>
					<Divider mb={4} />

					{authLoading || loading ? (
						<Box textAlign="center" py={8}>
							<Spinner size="lg" />
							<Text mt={4} color="gray.500">
								Loading your orders...
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
						<Box display="flex" flexDir="column" gap={3}>
							{orders.map((order) => (
								<Box
									key={order.id}
									border="1px solid"
									borderColor="gray.200"
									borderRadius="8px"
									padding={{ base: "0.75rem", md: "1rem" }}
									_hover={{ borderColor: "gray.300", shadow: "sm" }}
									transition="all 0.15s ease"
								>
									{/* Top row: order number + status */}
									<Box
										display="flex"
										justifyContent="space-between"
										alignItems="center"
										mb={2}
										flexWrap="wrap"
										gap={2}
									>
										<Box display="flex" alignItems="center" gap={2}>
											<Text
												fontWeight="700"
												fontFamily="mono"
												fontSize={{ base: "sm", md: "md" }}
											>
												{order.orderNumber}
											</Text>
											<Badge
												colorScheme={STATUS_COLORS[order.status] || "gray"}
												fontSize="xs"
											>
												{STATUS_LABELS[order.status] || order.status}
											</Badge>
										</Box>
										<Text fontSize="xs" color="gray.400">
											{new Date(order.createdAt).toLocaleDateString("en-NZ", {
												day: "numeric",
												month: "short",
												year: "numeric",
											})}
										</Text>
									</Box>

									{/* Details row */}
									<Box
										display="flex"
										justifyContent="space-between"
										alignItems="center"
										flexWrap="wrap"
										gap={2}
									>
										<Box
											display="flex"
											gap={3}
											flexWrap="wrap"
											fontSize="sm"
											color="gray.600"
										>
											<Text>
												{order.files?.length || 0} file
												{(order.files?.length || 0) !== 1 ? "s" : ""}
											</Text>
											<Text fontWeight="600" color="gray.800">
												${((order.pricing?.total || 0) / 100).toFixed(2)}
											</Text>
											{order.pickupTimeslot && (
												<Text>
													Pickup:{" "}
													{new Date(
														order.pickupTimeslot.date,
													).toLocaleDateString("en-NZ", {
														day: "numeric",
														month: "short",
													})}{" "}
													{order.pickupTimeslot.startTime}
												</Text>
											)}
										</Box>
										{renderOrderAction(order)}
									</Box>
								</Box>
							))}
						</Box>
					)}
				</Box>
				<Footer />
			</Box>
		</>
	);
};

export default MyOrders;
