import {
    Box,
    Image,
    Input,
    Heading,
    FormControl,
    Textarea,
    List,
    ListItem,
    Button,
    useMediaQuery,
} from "@chakra-ui/react";
import ProductCard from "../productcard/ProductCard";
import Footer from "../footer/Footer";

const OrderContainer = () => {
    const [smallScreen] = useMediaQuery(`(max-width: 800px)`);
    return (
        <>
            <Box
                paddingTop="1rem"
                display="grid"
                columnGap="1rem"
                rowGap="1rem"
                gridTemplateColumns={smallScreen ? "1fr" : "3fr 1.5fr"}
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
                        <Box
                            display="grid"
                            gridTemplateColumns={
                                smallScreen ? "1fr" : "1fr 1fr"
                            }
                        >
                            <ProductCard
                                orderPackage={{
                                    title: "test",
                                    included: ["1sdasd", "2dssd"],
                                    price: 20,
                                }}
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
                                    <Input type="text" borderRadius="sm" />
                                    <Input type="email" borderRadius="sm" />
                                </Box>
                                <Textarea borderRadius="sm" />
                            </Box>
                        </FormControl>
                    </Box>
                </Box>
                <Box
                    w="100%"
                    bg="white"
                    h="fit-content"
                    position={smallScreen ? "relative" : "sticky"}
                    padding="1rem .5rem"
                    top={smallScreen ? "0" : "5rem"}
                >
                    <Box display="flex" flexDir="column">
                        <Heading as="p">Total Price</Heading>
                        <List>
                            <ListItem>
                                Coursebook (Upload, 100-200 pages)
                            </ListItem>
                            <ListItem>Estimated Price</ListItem>
                            <Button variant="browned">Order Now</Button>
                        </List>
                    </Box>
                </Box>
            </Box>
            <Footer />
        </>
    );
};
export default OrderContainer;
