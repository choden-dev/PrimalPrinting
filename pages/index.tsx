import type { NextPage } from 'next'
import {
  Box,
  Image,
  Heading,

  Button,

} from '@chakra-ui/react'
import NavBar from '../components/navbar/NavBar'
import styles from '../styles/index.module.css'
import ProductDiv from '../components/productdiv/ProductDiv'
import TestimonialDiv from '../components/testimonialdiv/TestimonialDiv'
import SectionHeading from '../components/sectionheading/SectionHeading'
import DescriptionDiv from '../components/descriptiondiv/DescriptionDiv'
import WhatNextDiv from '../components/whatnextdiv/WhatNextDiv'
import Footer from '../components/footer/Footer'


const Home: NextPage = () => {
  return (
    <Box className="container">
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
          width="80%">
          <Heading
            className={styles.titletext}
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
        marginTop="8rem"
      >
        <Box className="secheading">
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
          <DescriptionDiv />
        </Box>
      </Box>
      <Box
        minHeight="16rem"
        marginTop="3rem"
        display="flex"
        flexDir="column"
        justifyContent="center"
      >
        <Box className="secheading">
          <SectionHeading text={"Testimonials"} />
        </Box>
        <Box display="flex"
          alignItems="center"
          margin="auto">
          <TestimonialDiv />
        </Box>
      </Box>

      <Box
        display="flex"
        width="100%"
        flexDir="column"

        marginTop="2rem"
      >
        <Box
          className="secheading"
        >
          <SectionHeading text={"Popular Products"} />
        </Box>
        <ProductDiv />

      </Box>
      <Box
        marginTop="3rem">
        <Box className="secheading">
          <SectionHeading text={"What Next?"} />
        </Box>
        <WhatNextDiv />
      </Box>
      <Footer />
    </Box >

  )
}

export default Home
