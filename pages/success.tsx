import { NextPage } from "next";
import NoSsr from "../components/NoSsr";
import { useRouter } from "next/router";
import {
    Box,
    Heading,
    Text,
    List,
    ListItem,
    Divider,
    Link,
} from "@chakra-ui/react";
import NavBar from "../components/navbar/NavBar";
import Footer from "../components/footer/Footer";
import OrderContainer from "../components/ordercontainer/OrderContainer";
const Success: NextPage = () => {
    const router = useRouter();
    const orderId = router.query.orderId;
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
                    <Divider margin="1rem 0" />
                    <Text textAlign="center" fontSize="1.5rem">
                        Thank you for your order, keep your order number for
                        reference:
                    </Text>
                    <Heading textAlign="center">{orderId}</Heading>
                    <Text marginTop="1rem" textAlign="center">
                        Please check your email for order confirmation + details
                        and email{" "}
                        <Link
                            fontWeight="700"
                            href="mailto: primalprintingnz@gmail.com"
                        >
                            primalprintingnz@gmail.com
                        </Link>{" "}
                        or{" "}
                        <Link fontWeight="700" href="/contact">
                            contact us
                        </Link>{" "}
                        there are any questions or concerns.
                    </Text>
                    <List>
                        <Box
                            display="flex"
                            flexDir="column"
                            alignItems="center"
                        ></Box>
                    </List>
                    <Divider margin="1rem 0" />
                    <Text fontSize="1.5rem"></Text>
                </Box>
                <Footer />
            </Box>
        </NoSsr>
    );
};
export default Success;
