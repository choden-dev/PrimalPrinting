import React, { useEffect } from 'react'
import { NextPage } from "next"
import {
    Box,
    Heading
} from '@chakra-ui/react'
import NavBar from "../components/navbar/NavBar"
import Footer from "../components/footer/Footer"
import { connectToDatabase } from "../lib/mongo"
import ShopItem from "../components/shopitem/ShopItem"
import ProductCard from "../components/productcard/ProductCard"

export async function getStaticProps() {
    try {
        let { db } = await connectToDatabase();
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

type ShopItem = {
    name: string;
    price: string;
    image: string;
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

    )
}
export default Shop