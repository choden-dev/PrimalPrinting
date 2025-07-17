import { Box, Heading, Text, Image } from "@chakra-ui/react";
import styles from "./DescriptionCard.module.css";
type Props = {
	name: string;
	description: string;
};

export default function DescriptionCard({ name, description }: Props) {
	return (
		<Box
			className={styles.container}
			minWidth="15rem"
			flex="1"
			padding="2rem"
			display="flex"
			flexDir="column"
			border="1px"
			borderColor="brown.200"
			borderRadius="sm"
			textAlign="left"
			minHeight="20rem"
			justifyContent="center"
			backgroundColor="white"
			gap="0.5rem"
			position="relative"
			boxShadow="0.2rem 0.2rem 0 #672212"
			transition="transform 0.5s, box-shadow 0.5s"
			zIndex="999"
			_hover={{
				transform: "translateY(-10px) translateZ(0)",
				boxShadow: "0.3rem 0.3rem 0 #672212",
			}}
		>
			<Image src="binder.png" position="absolute"></Image>
			<Heading alignSelf="flex-start" fontWeight="400" size="lg">
				{name}
			</Heading>

			<Text fontWeight="10" fontSize="lg">
				{description}
			</Text>
		</Box>
	);
}
