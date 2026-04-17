import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import type { NextPage } from "next";
import Head from "next/head";
import { getPayloadClient } from "@/lib/payload";
import Footer from "../components/footer/Footer";
import NavBar from "../components/navbar/NavBar";

export async function getServerSideProps({
	res,
}: {
	res: import("http").ServerResponse;
}) {
	// Cache at the CDN edge for 24 h, serve stale while revalidating for another 24 h
	res.setHeader(
		"Cache-Control",
		"public, s-maxage=86400, stale-while-revalidate=86400",
	);

	try {
		const payload = await getPayloadClient();
		const contactInfo = await payload.findGlobal({
			slug: "contact-info",
		});
		return {
			props: {
				contactInfo: JSON.parse(JSON.stringify(contactInfo)),
			},
		};
	} catch (_error) {
		console.log("could not fetch data");
		return {
			props: {
				contactInfo: { email: "", phone: "" },
			},
		};
	}
}

type ContactInfoData = {
	email: string;
	phone: string;
};

type PageProps = {
	contactInfo: ContactInfoData;
};

const Contact: NextPage<PageProps> = ({ contactInfo }) => {
	return (
		<>
			<Head>
				<title>Primal Printing - Contact</title>
				<meta property="og:type" content="website" />
				<meta
					property="og:title"
					content="Primal Printing New Zealand - Contact"
				/>
				<meta
					property="og:description"
					content="We are always happy to help! Feel free to consult us for support or queries about your printing needs."
				/>
				<meta
					property="og:url"
					content="https://primalprinting.co.nz/contact"
				/>
				<meta
					property="og:image"
					content="https://primalprinting.co.nz/primallogo.png"
				/>
			</Head>
			<Box className="container">
				<NavBar />
				<Box
					margin="5rem -7%"
					display="flex"
					flexDir="column"
					alignSelf="center"
					maxW="800px"
					width="100%"
					gap="1rem"
					padding="2rem"
					position="relative"
					bg="white"
					borderRadius="sm"
					border="1px"
					borderColor="brown.200"
				>
					<Heading fontWeight="500">Get in Touch</Heading>
					<Stack spacing="0">
						<Text fontSize="xl" fontWeight="500">
							Email: {contactInfo.email}
						</Text>
						<Text fontSize="xl" fontWeight="500">
							Phone: {contactInfo.phone}
						</Text>
					</Stack>
					<Text>
						If you have any questions or queries, feel free to reach out via
						email or phone!
					</Text>
				</Box>
				<Footer contactInfo={contactInfo} />
			</Box>
		</>
	);
};
export default Contact;
