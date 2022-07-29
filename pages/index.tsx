import type { NextPage } from 'next'
import {
  Box,
  Image,
  Heading,
  Text,
  Button,
  Divider,
  Grid
} from '@chakra-ui/react'
import NavBar from '../components/navbar/NavBar'
import styles from '../styles/index.module.css'
import DescriptionCard from '../components/descriptioncard/DescriptionCard'

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
          filter="brightness(0.5)"
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
            fontSize={{ base: "5rem", lg: "7rem", xl: "10rem" }}
            fontWeight="400"

          >
            We Print <br /> Anything!
          </Heading>
          <Button
            colorScheme="whiteAlpha"
            marginTop="5rem"
            fontWeight="300"
            size="lg">Explore our Products</Button>
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
          gap='4rem'
 
          justifyContent="center"
        >
          <DescriptionCard icon={''} name={'Low Prices'} description={'Lorem ipsum dolor sit amet consectetur adipisicing elit. Explicabo iste exercitationem odit quos, voluptatum nisi adipisci veniam maxime quasi vero ad unde ullam doloremque neque nesciunt consequatur quod vitae tempore.'} />
          <DescriptionCard icon={''} name={'Reliable'} description={'Lorem ipsum dolor sit amet consectetur adipisicing elit. Explicabo iste exercitationem odit quos, voluptatum nisi adipisci veniam maxime quasi vero ad unde ullam doloremque neque nesciunt consequatur quod vitae tempore.'} />
          <DescriptionCard icon={''} name={'Faster'} description={'Lorem ipsum dolor sit amet consectetur adipisicing elit. Explicabo iste exercitationem odit quos, voluptatum nisi adipisci veniam maxime quasi vero ad unde ullam doloremque neque nesciunt consequatur quod vitae tempore.'} />

        </Box>
        <Divider margin="2rem 0" />


      </Box>
    </Box >

  )
}

export default Home
