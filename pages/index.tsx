import { Box, Divider, Heading } from "@chakra-ui/react";
import type { SerializedEditorState } from "lexical";
import type { NextPage } from "next";
import Head from "next/head";
import { MessengerChat } from "react-messenger-chat-plugin";
import Footer from "../components/footer/Footer";
import IntroAnimation from "../components/intro/IntroAnimation";
import NoSsr from "../components/NoSsr";
import NavBar from "../components/navbar/NavBar";
import WhatNextDiv from "../components/whatnextdiv/WhatNextDiv";
import { getPayloadClient } from "../lib/payload";

export async function getStaticProps() {
	try {
		const payload = await getPayloadClient();

		const { docs: sections } = await payload.find({
			collection: "about-sections",
			limit: 100,
		});

		const contactInfo = await payload.findGlobal({
			slug: "contact-info",
		});

		// Convert Lexical rich text to HTML at build time
		const { convertLexicalToHTML } = await import(
			"@payloadcms/richtext-lexical/html"
		);

		const sectionsWithHtml = await Promise.all(
			sections.map(async (section) => {
				let html = "";
				if (section.content) {
					html = await convertLexicalToHTML({
						data: section.content as SerializedEditorState,
					});
				}
				return {
					id: section.id,
					title: section.title,
					html,
				};
			}),
		);

		return {
			props: {
				sections: sectionsWithHtml,
				contactInfo: JSON.parse(JSON.stringify(contactInfo)),
			},
			revalidate: 60 * 60,
		};
	} catch (error) {
		console.log(error);
		return {
			props: {
				sections: [],
				contactInfo: { email: "", phone: "" },
			},
		};
	}
}

type AboutSection = {
	id: string;
	title: string;
	html: string;
};

type ContactInfoData = {
	email: string;
	phone: string;
};

type PageProps = {
	sections: AboutSection[];
	contactInfo: ContactInfoData;
};

const Home: NextPage<PageProps> = ({ sections, contactInfo }) => {
	return (
		<>
			<Head>
				<title>Primal Printing - All your printing needs</title>
				<meta
					name="description"
					content="We're THE student run print shop at University of Auckland. 
We offer affordable printing and binding services, providing students with course books and manuals for as little as $9.99 
By Students, For Students💯🚀"
				/>
				<meta property="og:type" content="website" />
				<meta
					property="og:title"
					content="Primal Printing New Zealand - Affordable printing services!"
				/>
				<meta
					property="og:description"
					content="We're a student run print shop at University of Auckland, providing students with course books, lab manuals & more for a fraction of the usual cost!
By Students, For Students🚀💯"
				/>
				<meta property="og:url" content="https://primalprinting.co.nz" />
				<meta
					property="og:image"
					content="https://drive.google.com/uc?export=view&id=1Qz_2nuEozFbUypf4jcYApyF2KSkyiTnk"
				/>
			</Head>

			<Box className="container">
				<NavBar />
				<IntroAnimation />
				<Box
					id="about"
					marginTop="10rem"
					marginBottom="3rem"
					display="flex"
					justifyContent="center"
					alignSelf="center"
					bg="white"
					w="100vw"
					padding="3rem 2rem"
					border="1px"
					borderRadius="sm"
					borderColor="brown.200"
					position="relative"
				>
					<Box
						position="absolute"
						transformOrigin="top right"
						transform="rotate(90deg)"
						right="0"
						h="70%"
						w="4.5rem"
						bgImage="binder.png"
						top="2.7rem"
						bgRepeat="no-repeat"
					></Box>
					<Box
						padding="2rem 0"
						maxW="1000px"
						justifyContent="center"
						display="flex"
						flexDir="column"
					>
						<Heading color="brown.900" fontSize="4rem">
							About Us
						</Heading>
						<Divider borderColor="brown.900" margin="1rem 0" />
						<Box
							textAlign="left"
							display="flex"
							flexDir="column"
							gap="1.2rem"
							position="relative"
							className="rich-text-content"
							sx={{
								"& h1, & h2, & h3": {
									color: "brown.900",
									fontWeight: "bold",
									marginTop: "2rem",
								},
								"& h2": { fontSize: "3.2rem" },
								"& h3": { fontSize: "2rem" },
								"& p": {
									fontSize: "xl",
									fontWeight: "300",
									whiteSpace: "pre-line",
								},
								"& img": {
									width: "100%",
									objectFit: "cover",
									borderRadius: "sm",
								},
								"& b, & strong": {
									fontWeight: "600",
								},
							}}
						>
							{sections.map((section) => (
								<Box
									key={section.id}
									// biome-ignore lint/security/noDangerouslySetInnerHtml: Rich text HTML is generated server-side by Payload's Lexical converter
									dangerouslySetInnerHTML={{ __html: section.html }}
								/>
							))}
						</Box>
					</Box>
				</Box>
				<Box>
					<WhatNextDiv />
				</Box>
				<Footer contactInfo={contactInfo} />
			</Box>

			<NoSsr>
				<MessengerChat
					pageId="104194185696145"
					themeColor={""}
					loggedInGreeting={""}
					loggedOutGreeting={""}
				/>
			</NoSsr>
		</>
	);
};

export default Home;
