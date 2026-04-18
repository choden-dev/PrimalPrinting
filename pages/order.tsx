import { Box } from "@chakra-ui/react";
import type { NextPage } from "next";
import Head from "next/head";
import NavBar from "../components/navbar/NavBar";
import OrderContainer from "../components/ordercontainer/OrderContainer";
export async function getStaticProps() {
	return {
		props: {
			packages: [], // packages,
		},
		revalidate: 60 * 60,
	};
}
const Order: NextPage = () => {
	return (
		<>
			<Head>
				<title>Primal Printing - Order</title>
				<meta property="og:type" content="website" />
				<meta property="og:title" content="Primal Printing - Order" />
				<meta
					property="og:description"
					content="Want to get a pdf printed? Upload it here!"
				/>
				<meta property="og:url" content="https://primalprinting.co.nz/order" />
				<meta
					property="og:image"
					content="https://primalprinting.co.nz/primallogo.png"
				/>
			</Head>
			<Box className="container">
				<NavBar />
				<OrderContainer />
			</Box>
		</>
	);
};
export default Order;
