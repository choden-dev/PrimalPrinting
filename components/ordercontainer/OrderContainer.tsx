import { Box, Image, Input, FormControl } from "@chakra-ui/react";
import ProductCard from "../productcard/ProductCard";
import Footer from "../footer/Footer";

const OrderContainer = () => {
    return (
        <>
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
                    height="100%"
                    maxW="2.8rem"
                    overflowY="hidden"
                >
                    <Image src="/binder.png" alt="" />
                </Box>
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
                        <Box
                            display="grid"
                            gridTemplateColumns="1fr 1fr"
                            columnGap="1rem"
                        >
                            <Input type="text" />
                            <Input type="email" />
                        </Box>
                    </FormControl>
                </Box>
            </Box>
            <Footer />
        </>
    );
};
export default OrderContainer;
