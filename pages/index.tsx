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
import ProductDiv from '../components/productdiv/ProductDiv'
import TestimonialDiv from '../components/testimonialdiv/TestimonialDiv'
import SectionHeading from '../components/sectionheading/SectionHeading'
import DescriptionDiv from '../components/descriptiondiv/DescriptionDiv'
import WhatNextDiv from '../components/whatnextdiv/WhatNextDiv'
import Footer from '../components/footer/Footer'
import Link from 'next/link'
import { connectToDatabase } from '../lib/mongo'
import React from 'react'
export async function getStaticProps() {
  try {
    let { db } = await connectToDatabase('WebsiteText');
    let aboutText = await db
      .collection('Home1')
      .find({})
      .toArray();
    let whyText = await db
      .collection('WhyPrimal')
      .find({})
      .toArray();
    let popular = await db
      .collection('PopularProducts')
      .find({})
      .toArray();
    let testimonials = await db
      .collection('Testimonials')
      .find({})
      .toArray();
    let final = aboutText
      .concat(whyText)
      .concat(popular)
      .concat(testimonials);
    return {
      props:
      {
        text: JSON.parse(JSON.stringify(final)),
        revalidate: 60 * 60
      }
    };
  } catch (error) {
    console.log("couldn't fetch data");
  }
}

type PageProps = {
  text: any[];
}

const Home: NextPage<PageProps> = (text) => {
  const [content, setContent] = React.useState<any[]>([]);
  React.useEffect(() => {
    console.log(text.text)
    setContent(text.text);
  }, [])
  return (
    <>
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
        </Box>
        <Box
          marginTop="8rem"
          display="flex"
          alignItems="center"
          flexDir="column"
          textAlign="center">
          <Box className="secheading">
            <SectionHeading text={"Anything Printing"} />
          </Box>
          <Box marginTop="4rem">
            <Text maxWidth="1100px"
              fontSize="lg"
              fontWeight="300">
              {content.length > 0 && content[0].text}
            </Text>
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
            <Box position="absolute" bg="brown.700" width="100%" height="50%" bottom="0" />

            <DescriptionDiv descriptions={content.slice(1, 4)} />
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
          <ProductDiv products={content.slice(4, 7)} />

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
            {content.length > 8 && <TestimonialDiv testimonials={content.slice(7, 12)} />}
          </Box>
          <Box position="absolute" bottom="5rem" zIndex="-1" width="70%" height="10%" bg="brown.700" />

        </Box>

        <Box>

          <WhatNextDiv />
        </Box>
        <Footer />
      </Box >
    </>
  )
}

export default Home
