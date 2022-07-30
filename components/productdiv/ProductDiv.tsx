import {
    Box
} from '@chakra-ui/react'
import ProductCard from '../productcard/ProductCard'
type Props = {}

export default function ProductDiv({ }: Props) {
    return (
        <Box
            position="absolute"
            width="100vw"
            left="0"
            marginTop="3rem"
            display="flex"
            gap="2rem"
            justifyContent="center"
            backgroundColor="brown.100"
            padding="2rem"
            flexWrap="wrap">
            <ProductCard />
            <ProductCard />
            <ProductCard />
        </Box>
    )
}