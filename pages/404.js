import { Box, Heading, Button } from '@chakra-ui/react'
import { ExternalLinkIcon } from "@chakra-ui/icons"
import Link from 'next/link'
import NavBar from '../components/navbar/NavBar'
export default function errorPage() {
    return (
        <Box className="container"
            alignItems="center"
            height="100vh"
            marginTop="0"
            justifyContent="center">
            <NavBar />
            <Box className="container">
                <Box margin="auto"
                    position="relative">
                    <Box
                        width="50%"
                        height="30%"
                        bg="brown.100"
                        position="absolute"
                        left="0"
                        top="0"
                        zIndex="-1">

                    </Box>
                    <Heading fontSize="15rem"
                        lineHeight="10rem"
                        fontFamily="coffeematcha">
                        404.
                    </Heading>
                    <Heading fontWeight="300">
                        The page you were looking for was not found.
                    </Heading>
                    <Link href="/" passHref >
                        <Button
                            as={"a"}
                            variant="browned"
                            rightIcon={<ExternalLinkIcon />}
                            marginTop="1.5rem">
                            Back Home
                        </Button>
                    </Link>

                </Box>
            </Box>

        </Box>
    )
} 