import React from 'react'
import {
  Box,
  Heading,
  Button,
  Image
} from '@chakra-ui/react'

type Props = {
  name: string;
  price: string;
  imageUrl: string;
  hasButton: boolean;
}


export default function ShopItem({ name, price, imageUrl, hasButton }: Props) {
  return (
    <Box minW="20rem"
      maxW="20rem"
      padding="2rem"
      borderRadius="sm"
      display="flex"
      flexDir="column"
      bg="white"
      gap="1rem"
      boxShadow="0 0 3px rgb(33,33,33)">

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
      {hasButton && <Button marginTop="auto">
        Enquire
      </Button>}
    </Box>
  )
}