import React from 'react'
import {
    Box,
    Heading,
    UnorderedList,
    ListItem,
    Text,
    Divider,
    Center
} from '@chakra-ui/react'
type Props = {}

export default function Footer({ }: Props) {
    return (
        <Box
            width="100vw"
            backgroundColor="brown.100"
            transform="translateX(-7%)"
            marginTop="5rem"
            
            flexDir="column">
            <Box className="secheading"
                marginTop="2rem">
                <Heading
                    width="fit-content"
                    size="xl"
                    backgroundColor="brown.100"
                    z-index="998"
                    fontWeight="300"
                    padding="0 1rem"
                    color="brown.900"
                    position="absolute"
                >
                    More Info
                </Heading>


            </Box>
            <Box
                display="flex"
                maxWidth="1100px"
                margin="auto"
                padding="2rem"
                gap="5rem"
            >
                <UnorderedList
                    styleType="none">
                    <ListItem><Text fontWeight="500">Site</Text></ListItem>
                    <ListItem>About Primal Printing</ListItem>
                    <ListItem>Get in touch</ListItem>
                    <ListItem>Products</ListItem>

                </UnorderedList>
                <UnorderedList
                    styleType="none">
                    <ListItem><Text fontWeight="500">Support</Text></ListItem>
                    <ListItem>Contact</ListItem>
                    <ListItem>Make a Query</ListItem>
                </UnorderedList>

            </Box>
            <Text 
            textAlign="center">Copyright Primal Printing 2022</Text>
        </Box >
    )
}