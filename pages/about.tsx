import { NextPage } from "next"
import {
    Box,
    Heading,
    Text,
    Stack,
    Image
} from '@chakra-ui/react'
import NavBar from "../components/navbar/NavBar"
import Footer from "../components/footer/Footer"


const About: NextPage = () => {
    return (
        <Box

            className='container'>
            <NavBar />
            <Box
                alignSelf="center"
                display="flex"
                flexDir="column"

                maxWidth="800px"
                marginTop="3rem">
                <Box textAlign="center"
                    display="flex"
                    flexDir="column"
                    gap="1.5rem"
                    position="relative">
                    <Heading

                        size="4xl"
                        fontWeight="400">
                        Do you need Printing?
                    </Heading>
                    <Heading
                        fontWeight="300">
                        Helping all your printing needs
                    </Heading>
                    <Box
                        position="absolute"
                        width="100%"
                        height="3rem"
                        bg="brown.100"
                        zIndex="-1" />

                </Box>

                <Text
                    marginTop="2rem"
                    textAlign="left"
                    fontWeight="300"
                >
                    Lorem ipsum dolor sit amet consectetur, adipisicing elit. Quo vel, facilis rem tempore commodi aliquid molestiae esse accusantium inventore dolor perferendis cupiditate aperiam deserunt ad sapiente praesentium delectus! Doloremque, temporibus?
                </Text>
                <Stack direction="row"
                    alignSelf="center"
                    overflowX="auto"
                >
                    <Image
                        height="20rem"
                        src="placeholder.png" />
                    <Image
                        height="20rem"
                        src="placeholder.png" />
                    <Image
                        height="20rem"
                        src="placeholder.png" />
                </Stack>
            </Box>

            <Footer />
        </Box>

    )
}
export default About