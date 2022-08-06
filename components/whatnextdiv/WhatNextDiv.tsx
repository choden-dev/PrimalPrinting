import React from 'react'
import {
    Box,
    Heading,
    Link,
} from '@chakra-ui/react'
import {
    SunIcon
} from '@chakra-ui/icons'
import NextLink from 'next/link'

export default function WhatNextDiv() {
    return (
        <Box

            display="flex"
            textAlign={{ base: "center", md: "left" }}
            alignItems="center"
            justifyContent="center"
            gap="2rem"
            flexWrap="wrap"
            padding="2rem"
            bg="white"
            width="100vw"
            transform="translateX(-7%)"
            overflow="hidden"
            position="relative">
            <SunIcon w={"5rem"} h={"5rem"} color="brown.800" />

            <Box display="flex"
                flexDir="column"
                gap="0.5rem">
                <Heading
                    size="4xl"
                    fontWeight="400">
                    Like what you see?
                </Heading>
                <Heading
                    fontWeight="300"
                >
                    Get in touch or&nbsp;
                    <NextLink href="/shop" passHref>
                        <Link
                            as="a"
                            color="brown.700"
                            fontWeight="400">browse our shop
                        </Link>
                    </NextLink>
                </Heading>
            </Box>

        </Box>
    )
}