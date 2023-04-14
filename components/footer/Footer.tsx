import React from 'react'
import {
    Box,
	Divider,
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
			<Box maxWidth="1100px" margin="1rem" display="flex" flexDir="column">
            <Box maxWidth="1100px"  display="grid" gridTemplateColumns={smallScreen ? "1fr" : "5fr 3fr"}>
			<Image justifySelf={smallScreen ? "center" : "flex-start"} src="/primallogo.png" maxH="10rem"></Image>
                <Box
                    display="flex"
                    padding="1rem 0"
                    justifyContent="center"
                    gap={smallScreen ? "1rem" :"1rem"}
                    fontWeight="400"
                >
                    <UnorderedList
                        styleType="none">
                        <ListItem><Text fontWeight="800">Site</Text></ListItem>
                        <ListItem><Link href='/'>About Primal Printing</Link></ListItem>
                        <ListItem><Link href='/contact'>Get in touch</Link></ListItem>
						<ListItem><Link href='/contact'>Make a Query</Link></ListItem>
                    </UnorderedList>
                    <UnorderedList
                        styleType="none">
                        <ListItem><Text fontWeight="800">Social Media</Text></ListItem>
                    </UnorderedList>

                </Box>
            </Box>
			<Divider borderColor="brown.900" width="70%" marginBottom="10px"/>
            <Text
                fontWeight="500"
                textAlign="left"
                paddingBottom="0.5rem"><strong>&copy; Copyright Primal Printing 2023</strong>	|	02108678038	|	primalprintingnz@gmail.com</Text>
        </Box >
    </Box>)
}
