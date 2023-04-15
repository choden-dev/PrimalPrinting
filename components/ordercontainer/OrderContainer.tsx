import { Box, Image, Input, FormControl, Textarea } from "@chakra-ui/react";
import ProductCard from "../productcard/ProductCard";
import Footer from "../footer/Footer";

const OrderContainer = () => {
    return (
        <>
            <Box
                display="grid"
                columnGap="1rem"
                gridTemplateColumns="3fr 1.5fr"
            >
                <Box
                    bg="white"
                    padding="1rem"
                    position="relative"
                    overflowX="visible"
                >
                    <Box
                        position="absolute"
                        top="0"
                        left="-2rem"
                        h="100%"
                        w="2.8rem"
                        overflowY="hidden"
                        backgroundImage="/binder.png"
                    ></Box>
                    <Box display="flex" flexDir="column" gap="1rem">
                        <Box>
                            <ProductCard
                                productName=""
                                productPrice=""
                                productDescription=""
                                image=""
                                hasButton={true}
                            />
                        </Box>
                        <Box
                            w="100%"
                            h="10rem"
                            bg="brown.100"
                            borderRadius="2px"
                        ></Box>
                        <FormControl>
                            <Box display="flex" flexDir="column" gap="1rem">
                                <Box
                                    display="grid"
                                    gridTemplateColumns="1fr 1fr"
                                    columnGap="1rem"
                                >
                                    <Input type="text" />
                                    <Input type="email" />
                                </Box>
                                <Textarea />
                            </Box>
                        </FormControl>
                    </Box>
                </Box>
                <Box w="100%" bg="white" h="13rem"></Box>
            </Box>
            <Footer />
        </>
    );
};
export default OrderContainer;
