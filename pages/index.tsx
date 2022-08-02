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
import Link from 'next/link'


const Home: NextPage = () => {
  return (
    <Box
      className="container">
      <NavBar />

      <Box
        zIndex="999"
        className={styles.mainimage}>
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
          <Link href="/shop" passHref>
            <Button
              variant="browned"
              marginTop="5rem"
              fontWeight="300"
              size="lg">Explore our Products</Button>

          </Link>
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
          width="100vw"
          display="flex"
          justifyContent="center"
          padding="4rem 7%"
          position="relative"
        >
          <Box position="absolute" bg="brown.100" width="100%" height="50%" bottom="0" />

          <DescriptionDiv />
        </Box>
      </Box>
      <Box
        display="flex"
        width="100%"
        flexDir="column"

        marginTop="2rem"
      >
        <Box
          marginTop="3rem"
          className="secheading"
        >
          <SectionHeading text={"Popular Products"} />
        </Box>
        <ProductDiv />

      </Box>

      <Box
        minHeight="16rem"
        marginTop="3rem"
        display="flex"
        flexDir="column"
        position="relative"
        justifyContent="center"
        alignItems="center"
      >
        <Box className="secheading"
          marginTop="3rem">
          <SectionHeading text={"Testimonials"} />
        </Box>
        <Box display="flex"
          alignItems="center"
          padding="3rem 0">
          <TestimonialDiv />
        </Box>
        <Box position="absolute" bottom="5rem" zIndex="-1" width="70%" height="10%" bg="brown.100" />

      </Box>

      <Box>

        <WhatNextDiv />
      </Box>
      <Footer />
    </Box >

  )
}

export default Home
