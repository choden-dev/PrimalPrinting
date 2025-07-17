import {
	Box,
	Divider,
	Heading,
	ListItem,
	Text,
	UnorderedList,
} from "@chakra-ui/react";
import type { NextPage } from "next";
import { useRouter } from "next/router";
import DiscountBadge from "../components/discountbadge/DiscountBadge";
import Footer from "../components/footer/Footer";
import NoSsr from "../components/NoSsr";
import NavBar from "../components/navbar/NavBar";
import { orderSum } from "../lib/utils";

// Define the interface for order items
interface OrderItem {
	name: string;
	quantity: number;
	cost: number;
	discounted: boolean;
}

const OrderComplete: NextPage = () => {
	const router = useRouter();
	const orderId = router.query.orderId as string;
	const orderItems: OrderItem[] = router.query.items
		? JSON.parse(router.query.items as string)
		: [];

	const _sum = (): string => {
		let sum = 0;
		orderItems.forEach((item: OrderItem) => {
			sum += item.cost;
		});
		return sum.toFixed(2);
	};

	console.log(orderItems);

	return (
		<NoSsr>
			<Box className="container">
				<NavBar />
				<Box
					justifySelf="center"
					marginTop="2rem"
					maxWidth="1100px"
					bg="white"
					display="flex"
					flexDir="column"
					padding="1rem"
				>
					<Heading textAlign="center">{orderId}</Heading>
					<Divider margin="1rem 0" />
					<Text textAlign="center" fontSize="1.5rem">
						Thank you for your order, here are the details:
					</Text>
					<UnorderedList>
						<Box display="flex" flexDir="column" alignItems="center">
							{orderItems?.map((item: OrderItem) => (
								<ListItem fontSize="1.2rem" fontWeight="800" key={item.name}>
									<Box display="flex" gap=".5rem">
										<Text>
											{item.name} x {item.quantity}
										</Text>
										<Text marginLeft="1rem">${item.cost.toFixed(2)}</Text>
										<Box>
											<DiscountBadge displayCondition={item.discounted} />
										</Box>
									</Box>
								</ListItem>
							))}
						</Box>
					</UnorderedList>
					<Divider margin="1rem 0" />
					<Text fontSize="1.5rem">
						{orderItems && `Total: $${orderSum(orderItems)}`}
					</Text>
					<Text>
						{" "}
						Please transfer this to the account{" "}
						<strong>{process.env.NEXT_PUBLIC_BANK_ACCOUNT}</strong> with the
						reference <strong>{orderId}</strong> and check your email for the
						next steps!{" "}
						<strong>Note that the email may appear in your spam folder.</strong>
					</Text>
				</Box>
				<Footer />
			</Box>
		</NoSsr>
	);
};

export default OrderComplete;
