import { Box, Button, Divider, Heading, Spinner, Text } from "@chakra-ui/react";
import type { NextPage } from "next";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { getPayloadClient } from "@/lib/payload";
import Footer from "../components/footer/Footer";
import NoSsr from "../components/NoSsr";
import NavBar from "../components/navbar/NavBar";

type ContactInfoData = {
	email: string;
	phone: string;
};

type PageProps = {
	contactInfo: ContactInfoData;
};

export async function getServerSideProps() {
	try {
		const payload = await getPayloadClient();
		const contactInfo = await payload.findGlobal({ slug: "contact-info" });
		return {
			props: {
				contactInfo: JSON.parse(JSON.stringify(contactInfo)),
			},
		};
	} catch {
		return {
			props: {
				contactInfo: { email: "", phone: "" },
			},
		};
	}
}

interface PickupInstructionBlock {
	blockType: string;
	content?: unknown;
}

interface PickupInstructionProfileData {
	id: string;
	name: string;
	shortSummary?: string;
	instructions?: PickupInstructionBlock[];
}

interface OrderDetails {
	orderNumber: string;
	status: string;
	pricing: { subtotal: number; tax: number; total: number };
	files: {
		fileName: string;
		pageCount: number;
		copies: number;
		colorMode: string;
	}[];
	pickupTimeslot: {
		date: string;
		startTime: string;
		endTime: string;
		label: string;
		pickupInstructionProfile?: PickupInstructionProfileData | string | null;
	} | null;
}

/**
 * Render Payload/Lexical rich text JSON as React elements.
 * Handles basic node types: paragraph, text, list, heading.
 */
function RichTextContent({ content }: { content: unknown }): React.ReactElement | null {
	if (!content || typeof content !== "object") return null;

	const root = (content as { root?: { children?: unknown[] } }).root;
	if (!root?.children) return null;

	return <>{renderNodes(root.children)}</>;
}

type RichTextNode = {
	type?: string;
	text?: string;
	format?: number;
	tag?: string;
	listType?: string;
	url?: string;
	children?: RichTextNode[];
};

function renderNodes(nodes: unknown[]): React.ReactNode[] {
	return nodes.map((node, i) => {
		const n = node as RichTextNode;
		const key = `${n.type || "node"}-${i}`;

		if (n.type === "text" || (!n.type && typeof n.text === "string")) {
			let content: React.ReactNode = n.text || "";
			if (n.format && n.format & 1) content = <strong key={key}>{content}</strong>;
			if (n.format && n.format & 2) content = <em key={key}>{content}</em>;
			if (n.format && n.format & 4) content = <u key={key}>{content}</u>;
			return content;
		}

		const children = n.children ? renderNodes(n.children) : [];

		switch (n.type) {
			case "paragraph":
				return <Text key={key} mb={2}>{children}</Text>;
			case "heading": {
				if (n.tag === "h1") return <h1 key={key}>{children}</h1>;
				if (n.tag === "h2") return <h2 key={key}>{children}</h2>;
				if (n.tag === "h4") return <h4 key={key}>{children}</h4>;
				return <h3 key={key}>{children}</h3>;
			}
			case "list":
				return n.listType === "number"
					? <ol key={key} style={{ paddingLeft: "1.5rem", marginBottom: "0.5rem" }}>{children}</ol>
					: <ul key={key} style={{ paddingLeft: "1.5rem", marginBottom: "0.5rem" }}>{children}</ul>;
			case "listitem":
				return <li key={key}>{children}</li>;
			case "link":
			case "autolink":
				return <a key={key} href={n.url || "#"}>{children}</a>;
			case "linebreak":
				return <br key={key} />;
			default:
				return <span key={key}>{children}</span>;
		}
	});
}

/**
 * Order completion page.
 *
 * Displayed after a successful payment (Stripe redirect callback) or
 * when a user navigates here with an orderId query parameter.
 *
 * Fetches the order from the API and shows a confirmation summary.
 */
const OrderComplete: NextPage<PageProps> = ({ contactInfo }) => {
	const router = useRouter();
	const orderId = router.query.orderId as string | undefined;
	const [order, setOrder] = useState<OrderDetails | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!orderId) return;

		async function fetchOrder() {
			try {
				const res = await fetch(`/api/shop/${orderId}`);
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
							{order.files?.map((file) => (
								<Box
									key={`${file.fileName}-${file.copies}-${file.colorMode}`}
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
												"en-NZ",
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

									{/* Pickup Instructions */}
									{typeof order.pickupTimeslot.pickupInstructionProfile ===
										"object" &&
										order.pickupTimeslot.pickupInstructionProfile && (
											<Box
												mt={3}
												p={4}
												bg="blue.50"
												borderRadius="8px"
												borderLeft="4px solid"
												borderLeftColor="blue.400"
											>
												<Heading size="sm" color="blue.700" mb={2}>
													📋 Pickup Instructions —{" "}
													{order.pickupTimeslot.pickupInstructionProfile.name}
												</Heading>
												{order.pickupTimeslot.pickupInstructionProfile
													.shortSummary && (
													<Text fontWeight={500} mb={2}>
														{
															order.pickupTimeslot.pickupInstructionProfile
																.shortSummary
														}
													</Text>
												)}
												{order.pickupTimeslot.pickupInstructionProfile.instructions
													?.filter(
														(
															block,
														): block is PickupInstructionBlock & {
															content: unknown;
														} =>
															block.blockType === "richText" &&
															Boolean(block.content),
													)
													.map((block) => (
														<Box
															key={block.blockType}
															fontSize="sm"
															color="gray.700"
															mb={1}
														>
															<RichTextContent content={block.content} />
														</Box>
													))}
											</Box>
										)}
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
				<Footer contactInfo={contactInfo} />
			</Box>
		</NoSsr>
	);
};

export default OrderComplete;
