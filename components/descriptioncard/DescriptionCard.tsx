import {
    Box,
    Heading,
    Text,
    Image,
} from '@chakra-ui/react'
import styles from './DescriptionCard.module.css'
type Props = {

    name: string;
    description: string;
}

export default function DescriptionCard({ name, description }: Props) {
    return (
        <Box
            className={styles.container}
            minWidth="15rem"
            flex="1"
            padding="2rem"
            display="flex"
            flexDir="column"
            boxShadow="4px 0 15px rgb(33,33,33)"
            borderLeft="none"
            borderColor="brown.200"
            borderRadius="sm"
            alignContent="flex-start"
            textAlign="left"
            minHeight="20rem"
            backgroundColor="white"
            gap="0.5rem"
            position="relative"
            transition="transform 0.5s"

            _hover={{
                transform: "scale(1.01) translateZ(0)",
            }}

        >
            <Image
                src='binder.png'
                position="absolute"
                justifySelf="center"
            >
            </Image>
            <Heading
                alignSelf="flex-start"
                fontWeight="400"
                size="lg">
                {name}
            </Heading>

            <Text fontWeight="10"
                fontSize="lg">
                {description}
            </Text>
        </Box>
    )
}