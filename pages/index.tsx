import type { NextPage } from "next";
import Head from "next/head";
import { Box, Image, Heading, Text, useMediaQuery } from "@chakra-ui/react";
import NavBar from "../components/navbar/NavBar";
import NoSsr from "../components/NoSsr";
import TestimonialDiv from "../components/testimonialdiv/TestimonialDiv";
import SectionHeading from "../components/sectionheading/SectionHeading";
import { formatText } from "../types/helper";
import WhatNextDiv from "../components/whatnextdiv/WhatNextDiv";
import Footer from "../components/footer/Footer";
import { connectToDatabase } from "../lib/mongo";
import React from "react";
import { MessengerChat } from "react-messenger-chat-plugin";
export async function getStaticProps() {
    try {
        let { db } = await connectToDatabase("WebsiteText");

        let sections = await db
            .collection("AboutPage")
            .find({})
            .sort({ Order: 1 })
            .toArray();

        let testimonials = await db
            .collection("Testimonials")
            .find({})
            .toArray();

        let final = [sections].concat([testimonials]);
        return {
            props: {
                text: JSON.parse(JSON.stringify(final)),
                revalidate: 60 * 60,
            },
        };
    } catch (error) {
        console.log(error);
        return {
            props: {
                text: {},
            },
        };
    }
}

type PageProps = {
    text: any[];
};

const Home: NextPage<PageProps> = (text) => {
    const [smallScreen] = useMediaQuery("(max-width: 800px)");

    return (
        <>
            <Head>
                <title>Primal Printing - All your printing needs</title>
                <meta
                    name="description"
                    content="We offer affordable small and large scale printing in NZ for many paper products such as coursebooks, business cards, and more"
                />
                <meta property="og:type" content="website" />
                <meta
                    property="og:title"
                    content="Primal Printing New Zealand - Affordable printing services!"
                />
                <meta
                    property="og:description"
                    content="We offer affordable small and large scale printing in NZ for many paper products such as coursebooks, business cards, and more"
                />
                <meta
                    property="og:url"
                    content="https://primalprinting.co.nz"
                />
                <meta
                    property="og:image"
                    content="https://drive.google.com/uc?export=view&id=1Qz_2nuEozFbUypf4jcYApyF2KSkyiTnk"
                />
            </Head>

            <Box className="container">
                <NavBar />
                <Box marginTop="-5rem" display="flex" position="relative">
                    <Box
                        columnGap="1rem"
                        display="grid"
                        gridTemplateColumns={smallScreen ? "1fr" : "1fr 1fr"}
                        flexDir="column"
                        h="100vh"
                    >
                        <Image
                            opacity="0.7"
                            alignSelf="center"
                            src={"/coverimage.jpg"}
                            alt={"about page image"}
                            w="max(100vw, 30rem)"
                            objectFit="cover"
                        />

                        <Heading
                            as="h1"
                            zIndex="1"
                            color="brown.900"
                            fontSize="max(10vw, 6rem)"
                            fontWeight="800"
                            alignSelf="center"
                        >
                            Primal <br /> Printing
                        </Heading>
                    </Box>
                    <Box
                        width="100%"
                        justifyContent="center"
                        position="absolute"
                        bottom="0"
                    >
                        <Text textAlign="center" fontSize="2xl">
                            For students, By students
                        </Text>
                    </Box>
                </Box>
                <Box
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
                        maxW="1000px"
                        justifyContent="center"
                        display="flex"
                        flexDir="column"
                    >
                        <Heading color="brown.900" fontSize="4rem">
                            About Us
                        </Heading>
                        <Box
                            textAlign="center"
                            display="flex"
                            flexDir="column"
                            gap="1.2rem"
                            position="relative"
                        >
                            {text.text[0] &&
                                text.text[0].map((item: any) => {
                                    switch (item.Section) {
                                        case "Heading":
                                            return (
                                                <Heading
                                                    key={item._id}
                                                    fontWeight="300"
                                                >
                                                    {item.Text}
                                                </Heading>
                                            );
                                        case "Text":
                                            return (
                                                <>
                                                    <Text
                                                        key={item._id}
                                                        dangerouslySetInnerHTML={{
                                                            __html: item.Text,
                                                        }}
                                                        fontSize="xl"
                                                        textAlign="left"
                                                        fontWeight="300"
                                                        whiteSpace="pre-line"
                                                    />
                                                </>
                                            );
                                        case "Image":
                                            return (
                                                <Image
                                                    src={item.Text}
                                                    key={item._id}
                                                    alt={"about page image"}
                                                    width="100%"
                                                    objectFit="cover"
                                                />
                                            );
                                        default:
                                            return null;
                                    }
                                })}
                        </Box>
                    </Box>
                </Box>
                {false && (
                    <>
                        <Box
                            minHeight="16rem"
                            marginTop="3rem"
                            display="flex"
                            flexDir="column"
                            position="relative"
                            justifyContent="center"
                            alignItems="center"
                        >
                            <Box className="secheading" marginTop="3rem">
                                <SectionHeading text={"Testimonials"} />
                            </Box>
                            <Box
                                display="flex"
                                alignItems="center"
                                padding="3rem 0"
                            >
                                {text.text.length > 1 && (
                                    <TestimonialDiv
                                        testimonials={text.text[1]}
                                    />
                                )}
                            </Box>
                            <Box
                                position="absolute"
                                bottom="5rem"
                                zIndex="-1"
                                width="70%"
                                height="10%"
                                bg="brown.700"
                            />
                        </Box>
                    </>
                )}
                <Box>
                    <WhatNextDiv />
                </Box>
                <Footer />
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
