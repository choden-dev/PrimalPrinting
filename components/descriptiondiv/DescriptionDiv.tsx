import DescriptionCard from '../descriptioncard/DescriptionCard'
import { infoStructure } from '../../types/types'
import {
    Box
} from '@chakra-ui/react'
type Props = {
    descriptions: infoStructure[];
}


export default function DescriptionDiv({ descriptions }: Props) {
    return (
        <Box
            maxWidth="1100px"
            flexWrap="wrap"
            gap={{ base: '2rem', lg: '3rem' }}
            display="flex"
            justifyContent="center"
        >
            {descriptions.map((item, index) => {
                return <DescriptionCard key={item.title} name={item.title} description={item.description} />
            })}

        </Box>
    )
}