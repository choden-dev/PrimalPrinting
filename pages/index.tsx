import type { NextPage } from 'next'
import Head from 'next/head'
import {
  Box,
  Image,
  Heading,
  Text,
  useMediaQuery

} from '@chakra-ui/react'
import NavBar from '../components/navbar/NavBar'

import TestimonialDiv from '../components/testimonialdiv/TestimonialDiv'
import SectionHeading from '../components/sectionheading/SectionHeading'
import { formatText } from '../types/helper'
import WhatNextDiv from '../components/whatnextdiv/WhatNextDiv'
import Footer from '../components/footer/Footer'

import { connectToDatabase } from '../lib/mongo'
import React from 'react'
export async function getStaticProps() {
  try {
    let { db } = await connectToDatabase('WebsiteText');

    let sections = await db
      .collection('AboutPage')
      .find({})
      .sort({ 'Order': 1 })
      .toArray();

    let testimonials = await db
      .collection('Testimonials')
      .find({})
      .toArray();

    let final = [sections]
      .concat([testimonials]);
    return {
      props:
      {
        text: JSON.parse(JSON.stringify(final)),
        revalidate: 60 * 60
      }
    };
  } catch (error) {
    console.log(error);
    return {
      props: {
        text: {}
      }
    }
  }
}

type PageProps = {
  text: any[];
}

const Home: NextPage<PageProps> = (text) => {
  const [smallScreen] = useMediaQuery('(max-width: 800px)')

  return (
    <>
      <Head>
        <title>Primal Printing - All your printing needs</title>
        <meta name="description" content="We offer affordable small and large scale printing in NZ for many paper products such as coursebooks, buisness cards, and more" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Primal Printing New Zealand - Affordable printing services!" />
        <meta property="og:description" content="We offer affordable small and large scale printing in NZ for many paper products such as coursebooks, buisness cards, and more" />
        <meta property="og:url" content="https://primalprinting.co.nz" />
        <meta property="og:image" content="https://drive.google.com/uc?export=view&id=1Qz_2nuEozFbUypf4jcYApyF2KSkyiTnk" />
      </Head>

      <Box
        className="container">
        <NavBar />

        {  /*   <Box
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
              sx={{
                "@media only screen and (max-width: 420px)": {
                  fontSize: "4.5rem",
                }
              }}
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
        </Box> */}

        {       /* <Box
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
            <Box position="absolute" bg="brown.700" width="100%" height="50%" bottom="0" />

          </Box>
            </Box> */}
        {      /* <Box
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


            </Box> */}
        <Box
          margin="3rem 0"
          alignSelf="center"
          display="flex"
          flexDir="column"
          maxWidth="1100px"
          bg="white"
          padding="3rem 2rem"
          border="1px"
          borderRadius="sm"
          borderColor="brown.200"
          boxShadow="0.2rem 0.2rem 0 #672212">
          <Box textAlign="center"
            display="flex"
            flexDir="column"
            gap="1.2rem"
            position="relative">
            <Heading
              as="h1"
              zIndex="1"
              color="brown.900"
              size="4xl"
              fontWeight="400">
              Our Story
            </Heading>
            <Box height="5px" bg="brown.700" width="160px" alignSelf="center" marginTop="-0.7rem"></Box>
            {text.text[0] && text.text[0].map((item: any) => {
              switch (item.Section) {
                case "Heading":
                  return <Heading key={item._id} fontWeight="300">{item.Text}</Heading>
                case "Text":
                  return (
                    <>
                      <Text key={item._id}
                        dangerouslySetInnerHTML={{ __html: item.Text }
                        } fontSize="xl"
                        textAlign="left"
                        fontWeight="300"
                        whiteSpace="pre-line" />
                    </>
                  )
                case "Image":
                  return <Image src={item.Text} key={item._id} alt={"about page image"} width="100%" objectFit="cover" />
                default:
                  return null;
              }
            })}
          </Box>
        </Box>
        {false &&
          <>
            < Box
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
              <Box
                display="flex"
                alignItems="center"
                padding="3rem 0">
                {text.text.length > 1 && <TestimonialDiv testimonials={text.text[1]} />}
              </Box>
              <Box position="absolute" bottom="5rem" zIndex="-1" width="70%" height="10%" bg="brown.700" />

            </Box >
          </>
        }
        <Box>

          <WhatNextDiv />
        </Box>
        <Footer />
      </Box >
    </>
  )
}

export default Home
