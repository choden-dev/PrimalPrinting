import React from 'react'
import {
  Box,
  Heading,
  Button,
  Divider,
  Image
} from '@chakra-ui/react'

type Props = {
  name: string;
  price: string;
  imageUrl: string;
}


export default function shopitem({ name, price, imageUrl }: Props) {
  return (
    <Box minW="20rem"
      maxW="20rem"
      padding="2rem"
      borderRadius="sm"
      display="flex"
      flexDir="column"
      bg="white"
      gap="1rem">

      <Box
        height="15rem"
        overflow="hidden"
        width="20rem"
        margin="-2rem -2rem 0 -2rem">
        <Image

          src={imageUrl}
          alt={name} />
      </Box>

      <Heading>
        {name}
      </Heading>

      <Heading fontWeight="300">
        {price}
      </Heading>
      <Button marginTop="auto">
        Enquire
      </Button>
    </Box>
  )
}