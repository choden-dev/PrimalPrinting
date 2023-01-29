import Head from "next/head"
import React, { useEffect } from 'react'
import { NextPage } from "next"
import {
    Box,
    Heading
} from '@chakra-ui/react'
import NavBar from "../components/navbar/NavBar"
import Footer from "../components/footer/Footer"
import { connectToDatabase } from "../lib/mongo"
import { ShopItem } from '../types/types'
import ProductCard from "../components/productcard/ProductCard"

export async function getStaticProps() {
    try {
        let { db } = await connectToDatabase('Shop');
        let posts = await db
            .collection('Items')
            .find({})
            .toArray();
        // return the posts
        return {
            props:
            {
                message: JSON.parse(JSON.stringify(posts)),
                revalidate: 60 * 60 * 12
            }
        };
    } catch (error) {
        console.log("failed to get data");
    }
}


type PageProps = {
    message: ShopItem[];
}

const Shop: NextPage<PageProps> = (message) => {
    const [items, setItems] = React.useState<any[]>([])
    useEffect(() => {
        setItems(message.message);
    }, [])

    return (
        <>
            <Head>
                <title>Primal Printing - All your printing needs | Shop</title>
                <meta property="og:type" content="website" />
                <meta property="og:title" content="Primal Printing New Zealand - All your printing needs | Shop" />
                <meta property="og:description" content="Browse some examples of the affordable printing services we offer." />
                <meta property="og:url" content="https://primalprinting.co.nz/shop" />
                <meta property="og:image" content="https://primalprinting.co.nz/primallogo.png" />
            </Head>
            <Box className='container'>

                <NavBar />
                <Box
                    alignSelf="center"
                    margin="3rem 0"
                    display="flex"
                    flexDir="column"

                    gap="2rem">
                    <Heading
                        textAlign="center">Our Products</Heading>

                    <Box
                        justifyContent="center"
                        display="flex"
                        gap="2rem"
                        flexWrap="wrap"
                    >
                        {items.map((item, index) => {

                            return (<ProductCard
                                key={item.name}
                                productName={item.name}
                                productPrice={item.price}
                                productDescription={""}
                                image={item.image}
                                hasButton={false}
                            />)
                        })}
                    </Box>
                </Box>
                <Footer />

            </Box>
        </>
    )
}
export default Shop