import React from 'react'
import {

    Box,
    Heading,
    Button,
    Text
} from "@chakra-ui/react"
import styles from './ProductCard.module.css'
type Props = {
    productName: string;
    productPrice: string;
    productDescription: any;
    image: any;

}

export default function ProductCard({ productName, productPrice, productDescription, image }: Props) {
    return (
        <Box
            className={styles.productimage}
            display="flex"
            flexDir="column"
            minW="15rem"
            maxW="20rem"
            overflow="hidden"
            borderRadius="sm"
            backgroundColor="white"
            boxShadow="0 0 10px rgb(33,33,33)">
            <Box

                maxH="15rem"
                overflow="hidden">
                {image}
            </Box>
            <Box
                gap="1rem"
                display="flex"
                flexDir="column"
                padding="1.5rem">
                <Heading
                    fontWeight="300"
                    color="brown.800"
                    as="u">
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
                        fontSize="3xl"
                        fontWeight="500">
                        {productPrice}
                    </Text>
                    <Button
                        marginLeft="auto"
                        variant="outline">
                        Find out More
                    </Button>
                </Box>

            </Box>

        </Box >
    )
}