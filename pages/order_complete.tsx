import { NextPage } from "next";
import { useRouter } from "next/router";
import { Box, Heading } from "@chakra-ui/react";
import NavBar from "../components/navbar/NavBar";
import OrderContainer from "../components/ordercontainer/OrderContainer";
const OrderComplete: NextPage = () => {
    const router = useRouter();
    const orderId = router.query.orderId;
    return (
        <Box className="container">
            <NavBar />
            <Box>{orderId}</Box>
        </Box>
    );
};
export default OrderComplete;
