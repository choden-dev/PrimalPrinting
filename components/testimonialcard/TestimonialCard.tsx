import {
    Box,
    Heading,
    Text,
    Divider,
    Image,
} from '@chakra-ui/react'

type Props = {
}

export default function TestimonialCard({ }: Props) {
    return (
        <Box
            maxWidth="800px"
            display="flex"
            flexDir="column"
            justifyContent="center"
            textAlign="left"
            gap="2rem"
            padding="0 1rem"
            borderColor="brown.900"
            position="relative"
        >
            <Divider />
            <Box
                padding={{ base: "1rem", lg: "1rem 4rem" }}
            >
                <Image
                    position="absolute"
                    zIndex="-1"
                    src="quoteicon.png"
                    height="4rem"
                    width="6.5rem"
                    opacity="0.1"
                    top="2rem"
                    left="2rem"
                    transform="scaleX(-1)"
                />
                <Heading 
                fontWeight="500"
                color="brown.800">
                    Love
                </Heading>
                <Text>
                    Lorem ipsum dolor sit amet consectetur adipisicing elit. Laboriosam ipsum non amet impedit quis maiores adipisci vero dolore sed corrupti quasi labore suscipit laudantium nesciunt consequuntur et sapiente itaque ut, autem asperiores maxime vitae numquam culpa molestias. Fugit facilis totam voluptatibus asperiores magni at illo, quisquam ab velit quos laudantium?
                </Text>
                <Heading
                    fontWeight="light"
                    size="md"
                    textAlign="right">
                    -Yeddy yang
                </Heading>

            </Box>
            <Divider />
        </Box>
    )
}