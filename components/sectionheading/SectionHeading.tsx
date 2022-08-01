import {
    Heading
} from '@chakra-ui/react'
type Props = {
    text: string;
}

export default function SectionHeading({ text }: Props) {
    return (
        <Heading
            size="xl"
            
            z-index="998"
            fontWeight="300"
            padding="0 1rem"
            color="brown.900"
            position="absolute"

        >
            {text}
        </Heading>
    )
}