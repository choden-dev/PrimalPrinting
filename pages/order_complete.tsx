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
  UnorderedList,
} from "@chakra-ui/react";
import NavBar from "../components/navbar/NavBar";
import Footer from "../components/footer/Footer";
import OrderContainer from "../components/ordercontainer/OrderContainer";
import { orderSum } from "../lib/utils";
import DiscountBadge from "../components/discountbadge/DiscountBadge";
const OrderComplete: NextPage = () => {
  const router = useRouter();
  const orderId = router.query.orderId;
  const orderItems = router.query.items ? JSON.parse(router.query.items) : [];
  const sum = () => {
    let sum = 0;
    orderItems.map((item) => {
      sum += item.cost;
    });
    return sum.toFixed(2);
  };
  console.log(orderItems);
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
          <Heading textAlign="center">{orderId}</Heading>
          <Divider margin="1rem 0" />
          <Text textAlign="center" fontSize="1.5rem">
            Thank you for your order, here are the details:
          </Text>
          <UnorderedList>
            <Box display="flex" flexDir="column" alignItems="center">
              {orderItems &&
                orderItems.map((item) => {
                  return (
                    <ListItem
                      fontSize="1.2rem"
                      fontWeight="800"
                      key={item.name}
                    >
                      <Box display="flex" gap=".5rem">
                        <Text>
                          {item.name} x {item.quantity}
                        </Text>
                        <Text marginLeft="1rem">${item.cost.toFixed(2)}</Text>

                        <Box>
                          <DiscountBadge displayCondition={item.discounted} />
                        </Box>
                      </Box>
                    </ListItem>
                  );
                })}
            </Box>
          </UnorderedList>
          <Divider margin="1rem 0" />
          <Text fontSize="1.5rem">
            {orderItems && `Total: $${orderSum(orderItems)}`}
          </Text>
          <Text>
            {" "}
            Please transfer this to the account{" "}
            <strong>{process.env.NEXT_PUBLIC_BANK_ACCOUNT}</strong> with the
            reference <strong>{orderId}</strong> and check your email for the
            next steps! <strong>Note that the email may appear in your spam folder.</strong>
          </Text>
        </Box>
        <Footer />
      </Box>
    </NoSsr>
  );
};
export default OrderComplete;
