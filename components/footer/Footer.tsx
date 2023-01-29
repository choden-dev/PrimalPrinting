import React from 'react'
import {
    Box,
    Link,
    UnorderedList,
    ListItem,
    Text
} from '@chakra-ui/react'

type Props = {}

export default function Footer({ }: Props) {
    return (
        <Box
            width="100vw"
            backgroundColor="brown.100"
            transform="translateX(-7%)"
            marginTop="auto"
            flexDir="column"
            zIndex="999"
        >

            <Box
                display="flex"
                maxWidth="1100px"
                margin="auto"
                padding="2rem"
                gap="5rem"
                fontWeight="400"
            >
                <UnorderedList
                    styleType="none">
                    <ListItem><Text fontWeight="500">Site</Text></ListItem>
                    <ListItem><Link href='/about'>About Primal Printing</Link></ListItem>
                    <ListItem><Link href='/contact'>Get in touch</Link></ListItem>
                    <ListItem><Link href='/shop'>Products</Link></ListItem>

                </UnorderedList>
                <UnorderedList
                    styleType="none">
                    <ListItem><Text fontWeight="500">Support</Text></ListItem>
                    <ListItem><Link href='/contact'>Make a Query</Link></ListItem>
                </UnorderedList>

            </Box>
            <Text
                textAlign="center">Copyright Primal Printing 2023</Text>
        </Box >
    )
}