import React from 'react'
import {
    Box,
    Heading,
    Link
} from '@chakra-ui/react'
import {
    SunIcon
} from '@chakra-ui/icons'
type Props = {}

export default function WhatNextDiv({ }: Props) {
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
                Get in touch or <Link
                    color="brown.700"
                    fontWeight="400">browse our shop
                </Link>
            </Heading>
        </Box>
    )
}