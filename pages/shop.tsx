import React, { useEffect } from 'react'
import { NextPage } from "next"
import {
    Box
} from '@chakra-ui/react'
import NavBar from "../components/navbar/NavBar"
import Footer from "../components/footer/Footer"
import { connectToDatabase } from "../lib/mongo"

export async function getServerSideProps() {
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
                message: JSON.parse(JSON.stringify(posts))
            }
        };
    } catch (error) {
        console.log("failed to get data");
    }
}

type ShopItem = {
    name: string;
    price: string;
}

type PageProps = {
    message: ShopItem[];
}

const Shop: NextPage<PageProps> = (message) => {
    const [items, setItems] = React.useState<any[]>([])
    useEffect(() => {
        setItems(message.message)
    }, [])

    return (
        <Box className='container'>
            <NavBar />
            <Box marginTop="20rem">
                {items.map((item, index) => {
                    return <Box key={index}>{item.name} is {item.price}</Box>
                })}
            </Box>
            <Footer />

        </Box>

    )
}
export default Shop