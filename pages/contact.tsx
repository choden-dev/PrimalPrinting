import { NextPage } from "next"
import {
    Box,
    Heading,
    FormControl,
    FormLabel,
    Input,
    Textarea,
    Text,
    Button,
    Image
} from '@chakra-ui/react'
import NavBar from "../components/navbar/NavBar"
import Footer from "../components/footer/Footer"


const Contact: NextPage = () => {
    return (
        <Box className='container'>
            <NavBar />
            <Box
                margin="5rem 0"
                display="flex"
                flexDir="column"
                alignSelf="center"
                width="100%"
                maxW="800px"
                gap="1rem"
                position="relative"
            >
                <Box width="100%"
                    height="15rem"
                    borderRadius="sm"
                    overflow="hidden">
                    <Image src="photo.png"
                        alt=''
                        filter="brightness(0.5)" />

                </Box>
                <Box position="absolute"
                    width="60%"
                    height="2rem"
                    bg="brown.100"
                    top="16rem"
                    zIndex="-1" />

                <Heading fontWeight="500">
                    Get in Touch
                </Heading>
                <Text>If you have any questions or queries, ask away!</Text>
                <FormControl isRequired
                >
                    <FormLabel>
                        Name
                    </FormLabel>
                    <Input borderRadius="sm" type='text' />
                    <FormLabel>
                        Email
                    </FormLabel>
                    <Input borderRadius="sm" type='email' />
                    <FormLabel>
                        Message
                    </FormLabel>
                    <Textarea borderRadius="sm" size="lg" />
                </FormControl>
                <Button
                    variant="browned"
                    size="md" >
                    Send
                </Button>
            </Box>
            <Footer />
        </Box>

    )
}
export default Contact