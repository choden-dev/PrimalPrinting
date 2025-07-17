import { Box, Heading, Spinner, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";

type Props = {
	show: boolean;
	items: { name: string; percent: number }[];
};
export default function ProcessingOverlay({ show, items }: Props) {
	const [currentItems, setCurrentItems] = useState(items);
	useEffect(() => {
		setCurrentItems(items);
	}, [items]);
	return (
		<Box
			opacity="0.7"
			top="0"
			left="0"
			h="100vh"
			w="100vw"
			display={show ? "flex" : "none"}
			pos="fixed"
			justifyContent="center"
			alignItems="center"
			flexDir="column"
			zIndex="1000"
			gap=".5rem"
			bg="rgb(33,33,33)"
		>
			<Spinner h="20rem" w="20rem" thickness="1rem" color="brown.700" />
			<Text textAlign="center" fontSize="2rem" color="white">
				Currently processing your order... This might take up to a minute.
			</Text>
			{currentItems.map((item) => {
				return (
					<Heading as="p" color="white" key={item.name}>
						{item.name}: {item.percent}%
					</Heading>
				);
			})}
		</Box>
	);
}
