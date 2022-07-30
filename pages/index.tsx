import type { NextPage } from 'next'
import {
  Box,
  Image,
  Heading,
  Text,
  Button,

} from '@chakra-ui/react'
import NavBar from '../components/navbar/NavBar'
import styles from '../styles/index.module.css'
import DescriptionCard from '../components/descriptioncard/DescriptionCard'
import TestimonialCard from '../components/testimonialcard/TestimonialCard'
import SectionHeading from '../components/sectionheading/SectionHeading'
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
        textAlign="center"
        marginTop="3rem"
      >
        <Box className={styles.secheading}>
          <SectionHeading text={"Why Primal Printing?"} />
        </Box>
        <Box
          marginTop="3rem"
          width="100vw"
          backgroundColor="brown.100"
          display="flex"
          justifyContent="center"
          padding="4rem 7%"
        >
          <Box

            maxWidth="1500px"
            flexWrap="wrap"
            gap={{ base: '2rem', lg: '4rem' }}
            display="flex"
            justifyContent="center"

          >
            <DescriptionCard icon={''} name={'Low Prices'} description={'Lorem ipsum dolor sit amet consectetur adipisicing elit. Explicabo iste exercitationem odit quos, voluptatum nisi adipisci veniam maxime quasi vero ad unde ullam doloremque neque nesciunt consequatur quod vitae tempore.'} />
            <DescriptionCard icon={''} name={'Reliable'} description={'Lorem ipsum dolor sit amet consectetur adipisicing elit. Explicabo iste exercitationem odit quos, voluptatum nisi adipisci veniam maxime quasi vero ad unde ullam doloremque neque nesciunt consequatur quod vitae tempore.'} />
            <DescriptionCard icon={''} name={'Faster'} description={'Lorem ipsum dolor sit amet consectetur adipisicing elit. Explicabo iste exercitationem odit quos, voluptatum nisi adipisci veniam maxime quasi vero ad unde ullam doloremque neque nesciunt consequatur quod vitae tempore.'} />

          </Box>
        </Box>


      </Box>
      <Box
        minHeight="35rem"
        marginTop="3rem"
        display="flex"
        flexDir="column"
        justifyContent="center"
     
      >
        <Box className={styles.secheading}>
          <SectionHeading text={"Testimonials"} />
        </Box>
        <Box margin="auto">
          <TestimonialCard />
        </Box>
      </Box>

      <Box
        display="flex"
        width="100%"
        marginTop="3rem"
      >
        <Box
          className={styles.secheading}
        >
          <SectionHeading text={"Popular Products"} />
        </Box>
      </Box>
    </Box >

  )
}

export default Home
