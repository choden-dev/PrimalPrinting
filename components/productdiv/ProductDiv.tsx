import { Box } from "@chakra-ui/react";
import type { product } from "../../types/types";
import ProductCard from "../productcard/ProductCard";

type Props = {
	products: product[];
};

export default function ProductDiv({ products }: Props) {
	return (
		<Box
			width="100vw"
			transform="translateX(-7%)"
			marginTop="2rem"
			display="flex"
			gap="2rem"
			justifyContent="center"
			position="relative"
			padding="2rem"
			flexWrap="wrap"
		>
			<Box
				position="absolute"
				width="100%"
				bg="brown.700"
				height="50%"
				bottom="0"
			/>
			{products.map((item, index) => {
				return (
					<ProductCard
						key={item.title}
						productName={item.title}
						productPrice={item.price}
						productDescription={item.description}
						image={item.image}
						hasButton
					/>
				);
			})}
		</Box>
	);
}
