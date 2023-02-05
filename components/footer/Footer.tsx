import React from 'react'
import {
    Box,
    Link,
    UnorderedList,
    ListItem,
    Text,
    Image,
    useMediaQuery
} from '@chakra-ui/react'

type Props = {}

export default function Footer({ }: Props) {
    const [smallScreen] = useMediaQuery('(max-width: 800px)')
    return (
        <Box
            width="100vw"
            backgroundColor="brown.100"
            transform="translateX(-7%)"
            marginTop="auto"
            flexDir="column"
            zIndex="999"
            justifyContent="center"
            alignItems="center"
        >

            <Box maxWidth="1100px" margin="auto" alignItems={"center"} display="grid" gridTemplateColumns={smallScreen ? "1fr" : "1fr 1fr"}>
                <Box
                    display="flex"
                    padding="1rem 0"
                    justifyContent="center"
                    gap={smallScreen ? "1rem" :"5rem"}
                    fontWeight="400"
                >
                    <UnorderedList
                        styleType="none">
                        <ListItem><Text fontWeight="500">Site</Text></ListItem>
                        <ListItem><Link href='/'>About Primal Printing</Link></ListItem>
                        <ListItem><Link href='/contact'>Get in touch</Link></ListItem>
                    </UnorderedList>
                    <UnorderedList
                        styleType="none">
                        <ListItem><Text fontWeight="500">Support</Text></ListItem>
                        <ListItem><Link href='/contact'>Make a Query</Link></ListItem>
                    </UnorderedList>

                </Box>
                <Box display="flex"
                    flexDir={smallScreen ? "column" : "row"}
                    alignItems="center"
                    justifyContent="center"
                    justifySelf="center"
                    textAlign={smallScreen ? "center" : "right"}
                    paddingTop="1rem 0">
                    <UnorderedList styleType="none">
                        <ListItem><Text fontWeight="500">Get in Touch</Text></ListItem>
                        <ListItem>02108678038</ListItem>
                        <ListItem>primalprintingnz@gmail.com</ListItem>
                    </UnorderedList>

                    <Image src="/primallogo.png" maxH="10rem"></Image>

                </Box>
            </Box>

            <Text
                fontWeight="500"
                textAlign="center"
                paddingBottom="0.5rem">&copy; Copyright Primal Printing 2023</Text>
        </Box >
    )
}