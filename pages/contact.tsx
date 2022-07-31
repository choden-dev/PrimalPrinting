import { NextPage } from "next"
import {
    Box
} from '@chakra-ui/react'
import NavBar from "../components/navbar/NavBar"
import Footer from "../components/footer/Footer"


const Contact: NextPage = () => {
    return (
        <Box className='container'>
            <NavBar />
            <Footer />
        </Box>

    )
}
export default Contact