import {
    Box,
    Heading,
    Text,
    Icon,

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
            minWidth="20rem"
            width="40%"
            padding="2rem"
            display="flex"
            flexDir="column"
            border="1px"
            borderColor="brown.200"
            borderRadius="md"
            alignContent="flex-start"
            textAlign="left"
            gap="0.5rem">
            {icon}
            <Heading
                alignSelf="flex-start"
                fontWeight="300"
                size="lg">
                {name}
            </Heading>
            <Text fontWeight="10">
                {description}
            </Text>
        </Box>
    )
}