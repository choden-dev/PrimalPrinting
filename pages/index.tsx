import type { NextPage } from 'next'
import {
  Box,
  ColorModeScript,
  Image,
  Heading,
  Text
} from '@chakra-ui/react'
import NavBar from '../components/navbar/NavBar'
import styles from '../styles/index.module.css'
const Home: NextPage = () => {
  return (
    <Box className={styles.container}>
      <NavBar />
      <ColorModeScript initialColorMode='light' />
      <Box className={styles.mainimage}>
        <Image
          src='/banner.png'
          alt="books"
          minH="628px"
          minW="1200px"
          maxH="100vh"
          width="100%"
          filter="brightness(0.35)"
        />
        <Box
          position="absolute"
          justifyContent="center"
          alignItems="center"
          textAlign="center"
          width="70%">
          <Heading
            color="white"
            fontFamily="coffeematcha"
            fontSize={{ base: "4.5rem", lg: "7rem", xl: "10rem" }}
            fontWeight="400"

          >
            Coursebooks?
          </Heading>
          <Text
            fontSize={{ base: "xl", lg: "3xl" }}
            color="white"
            fontWeight="300"
            >
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Voluptas deleniti veritatis ea optio atque ipsum velit quae soluta nulla unde.
          </Text>
        </Box>
      </Box>
    </Box>

  )
}

export default Home
