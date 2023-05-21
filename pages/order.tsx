import { NextPage } from "next";
import { Box, Heading } from "@chakra-ui/react";
import NavBar from "../components/navbar/NavBar";
import OrderContainer from "../components/ordercontainer/OrderContainer";
import { getPackages, findPrice } from "../lib/stripe";
export async function getStaticProps() {
    let packages = await getPackages();
    // return the posts
    await Promise.all(
        packages.data.map(async (pack) => {
            const price = await findPrice(pack.default_price!.toString());
            pack.price = price;
        })
    );

    return {
        props: {
            packages,
        },
        revalidate: 60 * 60,
    };
}
const Order: NextPage = ({ packages }) => {
    return (
        <Box className="container">
            <NavBar />
            <OrderContainer packages={packages.data} />
        </Box>
    );
};
export default Order;
