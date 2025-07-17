import { CloseIcon } from "@chakra-ui/icons";
import { Box, IconButton, Select } from "@chakra-ui/react";
import type PdfCartItem from "../../types/models/PdfCartItem";

const UploadCard = ({
	uploadedItem,
	removeFunction,
	changeFunction,
}: {
	uploadedItem: PdfCartItem;
	removeFunction: (toRemove: PdfCartItem) => void;
	changeFunction: (option: boolean, toChange: PdfCartItem) => void;
}) => {
	const { displayName } = uploadedItem;
	return (
		<Box
			bg="white"
			height="fit-content"
			padding="1rem"
			borderRadius="sm"
			onClick={(e) => e.stopPropagation()}
			display="flex"
			flexDir="column"
		>
			<Box display="flex" w="100%" alignItems="center">
				<Box>
					Filename: <strong>{displayName}</strong> | {uploadedItem.getPages()}{" "}
					Pages
				</Box>
				<Box marginLeft="auto">
					Price: ${uploadedItem.getDisplayPrice().toFixed(2)}
				</Box>
				<IconButton
					aria-label="remove from uploads"
					icon={<CloseIcon />}
					variant={"unstyled"}
					onClick={(e) => {
						e.stopPropagation();
						removeFunction(uploadedItem);
					}}
				/>
			</Box>

			<Select
				defaultValue="B/W"
				onChange={(e) => {
					if (e.target.value === "B/W") changeFunction(false, uploadedItem);
					else changeFunction(true, uploadedItem);
				}}
				borderRadius="sm"
			>
				<option value="Colour">Colour</option>
				<option value="B/W">B/W</option>
			</Select>
		</Box>
	);
};

export default UploadCard;
