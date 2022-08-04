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
            borderRadius="sm"
            textAlign="left"
            minHeight="20rem"
            justifyContent="center"
            backgroundColor="white"
            gap="0.5rem"
            position="relative"
            boxShadow="0 0 4px rgb(33,33,33)"
            transition="transform 0.5s, box-shadow 0.5s"
            zIndex="999"
            _hover={{
                transform: "translateY(-10px) translateZ(0)",
                boxShadow: "4px 0 15px rgb(33,33,33)"
            }}
        >
            <Image
                src='binder.png'
                position="absolute"
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