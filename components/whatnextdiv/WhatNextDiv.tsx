import React from 'react'
import {
    Box,
    Heading,
    Link,
    Image
} from '@chakra-ui/react'
import {
    SunIcon
} from '@chakra-ui/icons'
import NextLink from 'next/link'

export default function WhatNextDiv() {
    return (
        <Box

            display="flex"
            flexDir="column"
            alignItems="center"
            justifyContent="center"
            gap="2rem"
            margin="2rem 0"
            marginTop="0"
            padding="2rem"
            width="100vw"
            transform="translateX(-7%)"
            overflow="hidden"
            position="relative">

            <Heading
                textAlign="center"
                size="4xl"
                fontWeight="400">
                Like what you see?
            </Heading>
            <Heading
                fontWeight="300"
                textAlign="center"
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
    )
}