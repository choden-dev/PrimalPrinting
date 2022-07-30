import React from 'react'
import {
    Image,
    Box,
    Heading,
    Button,
    Text
} from "@chakra-ui/react"
type Props = {}

export default function ProductCard({ }: Props) {
    return (
        <Box
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
                <Image
                    src="placeholder.png" />
            </Box>
            <Box
                gap="1rem"
                display="flex"
                flexDir="column"
                padding="1.5rem">
                <Heading
                    fontWeight="400"
                    color="brown.800"
                    as="u">
                    Love Them
                </Heading>
                <Text>
                    Lorem, ipsum dolor sit amet consectetur adipisicing elit. Quasi, ex repudiandae a suscipit doloremque optio possimus quis vel eligendi et?
                </Text>

                <Box display="flex"
                    alignItems="center">
                    <Text
                        color="brown.900"
                        fontSize="3xl"
                        fontWeight="700">
                        $69
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