import { CloseIcon } from "@chakra-ui/icons";
import { Box, IconButton } from "@chakra-ui/react";

const UploadCard = ({
    name,
    pages,
    price,
    removeFunction,
}: {
    name: string;
    pages: number;
    price: number;
    removeFunction: (name: string) => any;
}) => {
    return (
        <Box
            bg="white"
            height="3rem"
            padding="0 1rem"
            borderRadius="sm"
            display="flex"
            gap="1rem"
        >
            <Box>
                Filename: <strong>{name}</strong> | {pages} Pages
            </Box>
            <Box marginLeft="auto">Price: {price}</Box>
            <Box>Colour:</Box>
            <IconButton
                aria-label="remove from uploads"
                icon={<CloseIcon />}
                variant={"unstyled"}
                onClick={() => removeFunction(name)}
            />
        </Box>
    );
};

export default UploadCard;
