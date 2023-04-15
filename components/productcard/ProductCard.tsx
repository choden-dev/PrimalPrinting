import React from "react";
import { Box, Heading, Button, Text } from "@chakra-ui/react";
import Link from "next/link";
import styles from "./ProductCard.module.css";
import ItemModal from "../itemmodal/ItemModal";
import { OrderPackage } from "../../types/types";
type Props = {
    orderPackage: OrderPackage;
    image: string;
    hasButton: boolean;
};

export default function ProductCard({ orderPackage, image, hasButton }: Props) {
    const [infoOpen, setInfoOpen] = React.useState<boolean>(false);
    const openInfo = () => setInfoOpen(true);
    const closeInfo = () => setInfoOpen(false);

    return (
        <>
            <Box
                className={styles.productimage}
                display="flex"
                flexDir="column"
                maxW="20rem"
                border="1px"
                borderColor="brown.200"
                overflow="hidden"
                borderRadius="sm"
                height="fit-content"
                backgroundColor="white"
                zIndex="999"
                onClick={openInfo}
                cursor={!hasButton ? "pointer" : ""}
                transition="transform 0.5s, box-shadow 0.5s"
                _hover={{
                    boxShadow: "0.3rem 0.3rem 0 #672212",
                    transform: "scale(1.1)",
                }}
                sx={{
                    "@media screen and (max-width:750px)": {
                        maxWidth: "100%",
                    },
                }}
            >
                {!hasButton && (
                    <ItemModal
                        close={closeInfo}
                        isOpen={infoOpen}
                        imageUrl={image}
                        description={productDescription}
                        name={productName}
                    />
                )}

                <Box
                    className={styles.innersection}
                    transition="transform 0.5s"
                >
                    <Box maxH="15rem" overflow="hidden"></Box>
                    <Box
                        gap="1rem"
                        display="flex"
                        flexDir="column"
                        padding="1.5rem"
                    >
                        <Heading fontWeight="400" color="brown.900">
                            {orderPackage.title}
                        </Heading>
                        {orderPackage.included.map((item) => {
                            return (
                                <Text key={item} fontWeight="300">
                                    {item}
                                </Text>
                            );
                        })}

                        <Box display="flex" alignItems="center">
                            <Text
                                color="brown.900"
                                fontSize={hasButton ? "3xl" : "4xl"}
                                fontWeight="500"
                            >
                                {orderPackage.price.toFixed(2)}
                            </Text>
                            {hasButton && (
                                <Link href="/shop" passHref>
                                    <Button
                                        as="a"
                                        borderRadius="sm"
                                        marginLeft="auto"
                                        variant="browned"
                                        transition="background-color 0.4s"
                                    >
                                        Add
                                    </Button>
                                </Link>
                            )}
                        </Box>
                    </Box>
                </Box>
            </Box>
        </>
    );
}
