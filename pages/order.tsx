import { NextPage } from "next";
import { Box, Heading } from "@chakra-ui/react";
import NavBar from "../components/navbar/NavBar";
import OrderContainer from "../components/ordercontainer/OrderContainer";

const Order: NextPage = () => {
    return (
        <Box className="container">
            <NavBar />
            <OrderContainer />
        </Box>
    );
};
export default Order;
