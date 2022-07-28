import type { NextPage } from 'next'
import {
  Box,
  Image,
  Heading,
  Text,
  Divider,
  Grid
} from '@chakra-ui/react'
import NavBar from '../components/navbar/NavBar'
import styles from '../styles/index.module.css'
import DescriptionCard from '../components/descriptioncard/DescriptionCard'
import { Description } from '@mui/icons-material'

const Home: NextPage = () => {
  return (
    <Box className={styles.container}>
      <NavBar />
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
            fontSize={{ base: "4rem", lg: "7rem", xl: "10rem" }}
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

      <Box
        alignSelf="center"
        textAlign="center">
        <Heading
          marginTop="5rem"
          size="xl"
          fontWeight="300"
          color="brown.900">
          Why Primal Printing?
        </Heading>
        <Divider margin="2rem 0" />
        <Box display="flex"
          flexWrap="wrap"
          gap='1rem'
          maxW='60rem'
          justifyContent="center"
        >
          <DescriptionCard icon={<Image src='cheap.png' />} name={'Low Prices'} description={'Lorem ipsum dolor sit amet consectetur adipisicing elit. Explicabo iste exercitationem odit quos, voluptatum nisi adipisci veniam maxime quasi vero ad unde ullam doloremque neque nesciunt consequatur quod vitae tempore.'} />
          <DescriptionCard icon={<Image src='cheap.png' />} name={'Reliable'} description={'Lorem ipsum dolor sit amet consectetur adipisicing elit. Explicabo iste exercitationem odit quos, voluptatum nisi adipisci veniam maxime quasi vero ad unde ullam doloremque neque nesciunt consequatur quod vitae tempore.'} />

        </Box>

      </Box>
    </Box >

  )
}

export default Home
