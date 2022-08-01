import React, { useEffect } from 'react'
import { NextPage } from "next"
import {
    Box
} from '@chakra-ui/react'
import NavBar from "../components/navbar/NavBar"
import Footer from "../components/footer/Footer"



const Shop: NextPage = (data) => {
    const [items, setItems] = React.useState<any[]>([])
    useEffect(() => {
        fetch('/api/shop')
            .then((res) => res.json())
            .then((res) => setItems(res.message));
    }, [])

    return (
        <Box className='container'>
            <NavBar />
            <Box marginTop="20rem">
                {items.map((item, index) => {
                    return <Box>{item.name} is {item.price}</Box>
                })}
            </Box>
            <Footer />

        </Box>

    )
}
export default Shop