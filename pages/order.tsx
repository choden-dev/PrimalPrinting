import { NextPage } from "next";
import { Box, Heading } from "@chakra-ui/react";
import NavBar from "../components/navbar/NavBar";
import OrderContainer from "../components/ordercontainer/OrderContainer";
import { getPackages, findPrice } from "../lib/stripe";
import Head from "next/head";
export async function getStaticProps() {
  /* TODO: renable after packages are back
  let packages = await getPackages();
  // return the posts
  await Promise.all(
    packages.data.map(async (pack) => {
      const price = await findPrice(pack.default_price!.toString());
      pack.price = price;
    })
  );
  */

  return {
    props: {
      packages: [], // packages,
    },
    revalidate: 60 * 60,
  };
}
const Order: NextPage = ({ packages }) => {
  return (
    <>
      <Head>
        <title>Primal Printing - Order</title>
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Primal Printing - Order" />
        <meta
          property="og:description"
          content="Want to get a coursebook printed? Upload it here!"
        />
        <meta property="og:url" content="https://primalprinting.co.nz/order" />
        <meta
          property="og:image"
          content="https://primalprinting.co.nz/primallogo.png"
        />
      </Head>
      <Box className="container">
        <NavBar />
        <OrderContainer packages={packages.data} />
      </Box>
    </>
  );
};
export default Order;
