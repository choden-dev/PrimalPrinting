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
    addFunction: (
        id: string,
        name: string,
        priceId: string,
        price: number
    ) => any;
};

export default function ProductCard({
    orderPackage,
    image,
    hasButton,
    addFunction,
}: Props) {
    const [infoOpen, setInfoOpen] = React.useState<boolean>(false);
    const openInfo = () => setInfoOpen(true);
    const closeInfo = () => setInfoOpen(false);

    return (
        <>
            <Box
                className={styles.productimage}
                display="flex"
                flexDir="column"
                border="1px"
                borderColor="brown.200"
                overflow="hidden"
                borderRadius="sm"
                height="fit-content"
                backgroundColor="white"
                zIndex="999"
                onClick={openInfo}
                cursor={!hasButton ? "pointer" : ""}
            >
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
                        <Text>{orderPackage.description}</Text>
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
                                        onClick={() => addFunction}
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
