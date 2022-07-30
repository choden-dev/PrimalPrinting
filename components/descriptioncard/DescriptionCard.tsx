import {
    Box,
    Heading,
    Text,
    Image,
} from '@chakra-ui/react'
import styles from './DescriptionCard.module.css'
type Props = {
    icon: any;
    name: string;
    description: string;
}

export default function DescriptionCard({ icon, name, description }: Props) {
    return (
        <Box
            className={styles.container}
            minWidth="15rem"
            flex="1"
            padding="2rem"
            display="flex"
            flexDir="column"
            
            borderLeft="none"
            borderColor="brown.200"
            borderRadius="sm"
            alignContent="flex-start"
            textAlign="left"
            minHeight="20rem"
            backgroundColor="white"
            gap="0.5rem"
            position="relative"

        >
            <Image
                src='binder.png'
                position="absolute"

            >

            </Image>
            {icon}

            <Heading
                alignSelf="flex-start"
                fontWeight="400"
                size="lg">
                {name}
            </Heading>

            <Text fontWeight="10">
                {description}
            </Text>
        </Box>
    )
}