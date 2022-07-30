import DescriptionCard from '../descriptioncard/DescriptionCard'
import { infoStructure } from '../../contexts/types'
import {
    Box
} from '@chakra-ui/react'
type Props = {}

const descriptions: infoStructure[] =
    [
        { title: 'Low Prices', description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Explicabo iste exercitationem odit quos, voluptatum nisi adipisci veniam maxime quasi vero ad unde ullam doloremque neque nesciunt consequatur quod vitae tempore.' },
        { title: 'Reliable', description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Explicabo iste exercitationem odit quos, voluptatum nisi adipisci veniam maxime quasi vero ad unde ullam doloremque neque nesciunt consequatur quod vitae tempore.' },
        { title: 'Faster', description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Explicabo iste exercitationem odit quos, voluptatum nisi adipisci veniam maxime quasi vero ad unde ullam doloremque neque nesciunt consequatur quod vitae tempore.' }
    ]

export default function DescriptionDiv({ }: Props) {
    return (
        <Box
            maxWidth="1500px"
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