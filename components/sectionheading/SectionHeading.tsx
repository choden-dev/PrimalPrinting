import {
    Heading,
    Box
} from '@chakra-ui/react'
type Props = {
    text: string;
}

export default function SectionHeading({ text }: Props) {
    return (
        <Heading
            size="xl"

            z-index="998"
            fontWeight="400"
            color="brown.900"
            position="relative"

        >
            <Box justifyContent="center" display="flex" width="100%" height="5px" bottom="-12px" position="absolute" >
                <Box bg="brown.700" width="40%"></Box>
            </Box>
            {text}
        </Heading>
    )
}