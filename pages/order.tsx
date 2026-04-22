import { Box } from "@chakra-ui/react";
import type { NextPage } from "next";
import Head from "next/head";
import { getPayloadClient } from "@/lib/payload";
import NavBar from "../components/navbar/NavBar";
import OrderContainer from "../components/ordercontainer/OrderContainer";

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

const Order: NextPage<PageProps> = ({ contactInfo }) => {
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
				<OrderContainer contactInfo={contactInfo} />
			</Box>
		</>
	);
};
export default Order;
