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
    const submit = async (event: any) => {
        event.preventDefault();
        const message = event.target.message.value;
        const email = event.target.email.value;
        const res = await fetch('/api/form', {
            body: JSON.stringify({
                email: email,
                message: message
            }),
            headers: {
                'Content-Type': 'application/json',
            },
            method: 'POST',
        })
        const result = await res.json();
        alert(`${result.message}`);
    }
    return (
        <Box className='container'>
            <NavBar />
            <Box
                margin="5rem -7%"
                display="flex"
                flexDir="column"
                alignSelf="center"
                maxW="800px"
                width="100%"
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
                <form onSubmit={submit}>
                    <FormControl isRequired
                    >
                        <FormLabel>
                            Name
                        </FormLabel>
                        <Input borderRadius="sm" type='text' />
                        <FormLabel>
                            Email
                        </FormLabel>
                        <Input name="email" borderRadius="sm" type='email' />
                        <FormLabel>
                            Message
                        </FormLabel>
                        <Textarea name="message" borderRadius="sm" size="lg" />
                    </FormControl>
                    <Button
                        marginTop="1.5rem"
                        width="100%"
                        type="submit"
                        variant="browned"
                        size="md" >
                        Send
                    </Button>
                </form>
            </Box>
            <Footer />
        </Box >

    )
}
export default Contact