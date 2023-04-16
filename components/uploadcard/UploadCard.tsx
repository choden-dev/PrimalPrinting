import { Box } from "@chakra-ui/react";

const UploadCard = ({
    name,
    pages,
    price,
}: {
    name: string;
    pages: number;
    price: string;
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
            <Box>Quantity:</Box>
        </Box>
    );
};

export default UploadCard;
