import {
    Box,
    Image
} from '@chakra-ui/react'
import ProductCard from '../productcard/ProductCard'
import { infoStructure } from '../../contexts/types'
type Props = {}

type product = infoStructure & { image: any, price: string }

const products: product[] = [
    { title: "Coursebook", image: <Image src='placeholder.png' />, description: "Lorem, ipsum dolor sit amet consectetur adipisicing elit. Recusandae delectus corporis eos quod consequatur sapiente iusto quibusdam impedit quas ex!", price: "$69" },
    { title: "Print", image: <Image src='placeholder.png' />, description: "Lorem, ipsum dolor sit amet consectetur adipisicing elit. Recusandae delectus corporis eos quod consequatur sapiente iusto quibusdam impedit quas ex!", price: "$69" },
    { title: "Love", image: <Image src='placeholder.png' />, description: "Lorem, ipsum dolor sit amet consectetur adipisicing elit. Recusandae delectus corporis eos quod consequatur sapiente iusto quibusdam impedit quas ex!", price: "$69" }
]
export default function ProductDiv({ }: Props) {
    return (
        <Box

            width="100vw"
            transform="translateX(-7%)"
            marginTop="3rem"
            display="flex"
            gap="2rem"
            justifyContent="center"
            backgroundColor="brown.100"
            padding="2rem"
            flexWrap="wrap" >
            {products.map((item, index) => {
                return <ProductCard key={item.title} productName={item.title} productPrice={item.price} productDescription={item.description} image={item.image} />
            })}
        </Box >
    )
}