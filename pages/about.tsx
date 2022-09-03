import React from "react"
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
import { connectToDatabase } from "../lib/mongo"
export async function getStaticProps() {
    try {
        let { db } = await connectToDatabase('WebsiteText');
        let sections = await db
            .collection('AboutPage')
            .find({})
            .sort({ 'Order': 1 })
            .toArray();
        return {
            props: {
                content: JSON.parse(JSON.stringify(sections)),
                revalidate: 60 * 60
            }
        }

    } catch (error) {
        console.log("failed to fetch data");
    }
}

type PageProps = {
    content: any[];
}

const About: NextPage<PageProps> = (content) => {
    const [sections, setSections] = React.useState<any[]>([]);
    React.useEffect(() => {
        setSections(content.content);
    })

    return (
        <Box
            className='container'>
            <NavBar />
            <Box
                margin="3rem 0"
                alignSelf="center"
                display="flex"
                flexDir="column"
                maxWidth="1100px"
                bg="white"
                padding="3rem 2rem"
                border="1px"
                borderRadius="sm"
                borderColor="brown.200"
                boxShadow="0.2rem 0.2rem 0 #672212">
                <Box textAlign="center"
                    display="flex"
                    flexDir="column"
                    gap="1.2rem"
                    position="relative">
                    <Heading
                        zIndex="1"
                        color="brown.900"
                        size="4xl"
                        fontWeight="400">
                        Our Story
                    </Heading>
                    <Box height="5px" bg="brown.700" width="160px" alignSelf="center" marginTop="-0.7rem"></Box>
                    {sections.length > 0 && sections.map((item, index) => {
                        switch (item.Section) {
                            case "Heading":
                                return <Heading key={item._id} fontWeight="300">{item.Text}</Heading>
                            case "Text":
                                return <Text key={item._id} fontSize="xl" textAlign="left" fontWeight="300">{item.Text}</Text>
                            case "Image":
                                return <Box key={item._id} display="flex" maxWidth="1100px"><Image src={item.Text} alt="about page image" /></Box>
                            default:
                                return null;
                        }
                    })}
                </Box>


            </Box>

            <Footer />
        </Box >

    )
}
export default About