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
    Image,
    Stack
} from '@chakra-ui/react'
import NavBar from "../components/navbar/NavBar"
import Footer from "../components/footer/Footer"


const Contact: NextPage = () => {
    return (
        <Box className='container'>
            <NavBar />
            <Box
                margin="5rem -7%"
                display="flex"
                flexDir="column"
                alignSelf="center"

                maxW="800px"
                gap="1rem"
                padding="2rem"
                position="relative"
                bg="white"
                borderRadius="sm"
                border="1px"
                borderColor="brown.200"
                boxShadow="0.2rem 0.2rem 0 #672212"
            >
                <Box width="100%"
                    height="15rem"
                    borderRadius="sm"
                    overflow="hidden">
                    <Image src="photo.png"
                        alt=''
                        filter="brightness(0.5)" />

                </Box>

                <Heading fontWeight="500">
                    Get in Touch
                </Heading>
                <Stack spacing="0">
                    <Text fontSize="xl" fontWeight="500">Email: primalprinting@email.com</Text>
                    <Text fontSize="xl" fontWeight="500">Phone: 0000000000</Text>
                </Stack>

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
        </Box >

    )
}
export default Contact