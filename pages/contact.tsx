import Head from "next/head";
import React, { useState } from "react";
import { NextPage } from "next";
import {
    Box,
    Heading,
    FormControl,
    FormLabel,
    Input,
    Textarea,
    Text,
    Button,
    Image,
    Stack,
} from "@chakra-ui/react";
import NavBar from "../components/navbar/NavBar";
import Footer from "../components/footer/Footer";
import { connectToDatabase } from "../lib/mongo";

export async function getStaticProps() {
    try {
        let { db } = await connectToDatabase("WebsiteInfo");
        let details = await db.collection("Contacts").find({}).toArray();
        return {
            props: {
                details: JSON.parse(JSON.stringify(details)),
                revalidate: 24 * 60 * 60,
            },
        };
    } catch (error) {
        console.log("could not fetch data");
    }
}

type PageProps = {
    details: any[];
};

const Contact: NextPage<PageProps> = (details) => {
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [isDone, setIsDone] = useState<boolean>(false);

    const submit = async (event: any) => {
        event.preventDefault();
        setIsProcessing(true);
        const name = event.target.name.value;
        const message = event.target.message.value;
        const email = event.target.email.value;
        const res = await fetch("https://formspree.io/f/mqkoebvo", {
            body: JSON.stringify({
                name: name,
                email: email,
                message: message,
            }),
            headers: {
                "Content-Type": "application/json",
            },
            method: "POST",
        });
        if (res.ok) {
            alert(`Submitted!`);
            setIsProcessing(false);
            setIsDone(true);
        } else {
            alert(`something went wrong`);
            console.warn("Something went wrong");
            setIsProcessing(false);
        }
    };

    const submitted = (
        <>
            <Heading fontWeight="400" textAlign="center">
                Thank You!
                <br /> We will get back to you soon.
            </Heading>
            <Button variant="browned" onClick={() => setIsDone(false)}>
                Submit Another
            </Button>
        </>
    );

    return (
        <>
            <Head>
                <title>
                    Primal Printing - All your printing needs | Contact
                </title>
                <meta property="og:type" content="website" />
                <meta
                    property="og:title"
                    content="Primal Printing New Zealand - All your printing needs | Contact"
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
                    boxShadow="0.2rem 0.2rem 0 #672212"
                >
                    <Box
                        width="100%"
                        height="15rem"
                        borderRadius="sm"
                        overflow="hidden"
                    >
                        <Image
                            src="photo.png"
                            alt=""
                            filter="brightness(0.5)"
                        />
                    </Box>

                    <Heading fontWeight="500">Get in Touch</Heading>
                    <Stack spacing="0">
                        <Text fontSize="xl" fontWeight="500">
                            Email:{" "}
                            {details.details[0] && details.details[0].email}
                        </Text>
                        <Text fontSize="xl" fontWeight="500">
                            Phone:{" "}
                            {details.details[0] && details.details[0].phone}
                        </Text>
                    </Stack>
                    {isDone ? (
                        submitted
                    ) : (
                        <>
                            <Text>
                                If you have any questions or queries, ask away!
                            </Text>
                            <form
                                onSubmit={submit}
                                style={
                                    isProcessing
                                        ? {
                                              pointerEvents: "none",
                                              filter: "blur(1rem)",
                                          }
                                        : {}
                                }
                            >
                                <FormControl isRequired>
                                    <FormLabel>Name</FormLabel>
                                    <Input
                                        name="name"
                                        borderRadius="sm"
                                        type="text"
                                    />
                                    <FormLabel>Email</FormLabel>
                                    <Input
                                        name="email"
                                        borderRadius="sm"
                                        type="email"
                                    />
                                    <FormLabel>Message</FormLabel>
                                    <Textarea
                                        name="message"
                                        borderRadius="sm"
                                        size="lg"
                                    />
                                </FormControl>
                                <Button
                                    marginTop="1.5rem"
                                    width="100%"
                                    type="submit"
                                    variant="browned"
                                    size="md"
                                >
                                    Send
                                </Button>
                            </form>
                        </>
                    )}
                </Box>
                <Footer />
            </Box>
        </>
    );
};
export default Contact;

