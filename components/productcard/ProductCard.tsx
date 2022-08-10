import React from 'react'
import {
    Box,
    Heading,
    Button,
    Text
} from "@chakra-ui/react"
import Link from 'next/link'
import styles from './ProductCard.module.css'
import ItemModal from '../itemmodal/ItemModal'
type Props = {
    productName: string;
    productPrice: string;
    productDescription: any;
    image: string;
    hasButton: boolean;

}

export default function ProductCard({ productName, productPrice, productDescription, image, hasButton }: Props) {
    const [infoOpen, setInfoOpen] = React.useState<boolean>(false);
    const openInfo = () => setInfoOpen(true);
    const closeInfo = () => setInfoOpen(false);

    return (
        <>
            <Box
                className={styles.productimage}
                display="flex"
                flexDir="column"
                minW="15rem"
                maxW="20rem"
                border="1px"
                borderColor="brown.200"
                overflow="hidden"
                boxShadow="0.2rem 0.2rem  #672212"
                borderRadius="sm"
                height="fit-content"
                backgroundColor="white"
                zIndex="999"
                onClick={openInfo}
                cursor={!hasButton ? "pointer" : ""}
                transition="transform 0.5s, box-shadow 0.5s"
                _hover={
                    {
                        boxShadow: "0.3rem 0.3rem 0 #672212",
                        transform: "scale(1.1)"
                    }}
                sx={{
                    "@media screen and (max-width:750px)": {
                        maxWidth: "100%"
                    }
                }}>
                {!hasButton && <ItemModal open={openInfo} close={closeInfo} isOpen={infoOpen} />}

                <Box className={styles.innersection}
                    transition="transform 0.5s"
                >
                    <Box
                        maxH="15rem"
                        overflow="hidden">
                        <img
                            src={image}
                            alt={productName}
                        />
                    </Box>
                    <Box
                        gap="1rem"
                        display="flex"
                        flexDir="column"
                        padding="1.5rem">
                        <Heading
                            fontWeight="400"
                            color="brown.900">
                            {productName}
                        </Heading>
                        <Text
                            fontWeight="300">
                            {productDescription}
                        </Text>

                        <Box display="flex"
                            alignItems="center">
                            <Text
                                color="brown.900"
                                fontSize={hasButton ? "3xl" : "4xl"}
                                fontWeight="500">
                                {productPrice}
                            </Text>
                            {hasButton &&
                                <Link href="/shop" passHref>
                                    <Button
                                        as="a"
                                        borderRadius="sm"
                                        marginLeft="auto"
                                        variant="outline"
                                        transition="background-color 0.4s"
                                        _hover={{
                                            color: "white",
                                            bg: "brown.800"
                                        }}>
                                        Find out More
                                    </Button>
                                </Link>}
                        </Box>
                    </Box>
                </Box>

            </Box >
        </>
    )
}