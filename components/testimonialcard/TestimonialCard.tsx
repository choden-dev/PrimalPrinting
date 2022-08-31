import {
    Box,
    Heading,
    Text,
    Image,
    Button,
} from '@chakra-ui/react'
import {
    ExternalLinkIcon
} from '@chakra-ui/icons'
import { testimonial } from '../../types/types'
type Props = {
    toDisplay: testimonial;
}

export default function TestimonialCard({ toDisplay }: Props) {
    return (
        <Box
            maxWidth="1300px"
            display="flex"
            flexDir="column"
            justifyContent="center"
            textAlign="left"
            margin="3rem 0"
            bg="white"
            position="relative"
            zIndex="999"
            borderRadius="sm"
            padding="2rem"
            border="1px"
            borderColor="brown.200"
            boxShadow="0.2rem 0.2rem 0 #672212"
        >
            <Box
                padding={{ base: "1rem", lg: "1rem 4rem" }}
                display="flex"
                flexDir="column"
                gap="2rem"
                maxWidth="800px"
            >
                <Image
                    position="absolute"
                    zIndex="-1"
                    src="quoteicon.png"
                    height="4rem"
                    width="6.5rem"
                    opacity="0.1"
                    top="1.5rem"
                    left="2rem"
                    transform="scaleX(-1)"
                />
                <Heading
                    fontWeight="500"
                >
                    {toDisplay.title}
                </Heading>
                <Text
                    fontSize="lg"
                    fontWeight="300">
                    {toDisplay.description}
                </Text>
                <Box display="flex"
                    alignItems="center">
                    <a href="https://www.instagram.com/stories/highlights/17860217396773029/"
                        rel="noopener noreferrer"
                        target="_blank">
                        <Button
                            leftIcon={<ExternalLinkIcon />}
                            width="8rem"
                            variant="browned">
                            See More
                        </Button>
                    </a>
                    <Heading
                        marginLeft="auto"
                        fontWeight="400"
                        size="sm"
                        textAlign="right">
                        {toDisplay.author.trim() !== "" && toDisplay.author}
                    </Heading>

                </Box>
            </Box>
        </Box>
    )
}