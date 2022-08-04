import React, { useEffect } from 'react'
import { NextPage } from "next"
import {
    Box
} from '@chakra-ui/react'
import NavBar from "../components/navbar/NavBar"
import Footer from "../components/footer/Footer"
import { connectToDatabase } from "../lib/mongo"
import ShopItem from "../components/shopitem/ShopItem"
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
    imageUrl: string;
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
                marginTop="5rem"
                display="flex"
                gap="2rem"
                flexWrap="wrap">
                {items.map((item, index) => {
                    return <ShopItem key={item.name} name={item.name} price={item.price} imageUrl={item.image} />
                })}
            </Box>
            <Footer />

        </Box>

    )
}
export default Shop