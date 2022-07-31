import React from 'react'
import {
    Box,
    Heading,
    Link
} from '@chakra-ui/react'
import {
    SunIcon
} from '@chakra-ui/icons'
import NextLink from 'next/link'

export default function WhatNextDiv() {
    return (
        <Box
            marginTop="3rem"
            display="flex"
            flexDir="column"
            alignItems="center"
            justifyContent="center"
            gap="2rem"
            minHeight="20rem">
            <SunIcon w={20} h={20}
                color="brown.200" />
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