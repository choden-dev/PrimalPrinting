import { Box } from "@chakra-ui/react";

const UploadCard = ({ name, pages }: { name: string; pages: number }) => {
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
            <Box marginLeft="auto">Price:</Box>
            <Box>Quantity:</Box>
        </Box>
    );
};

export default UploadCard;
