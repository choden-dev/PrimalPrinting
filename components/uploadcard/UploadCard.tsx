import { Box } from "@chakra-ui/react";

const UploadCard = ({ name, pages }: { name: string; pages: number }) => {
    return (
        <Box
            bg="white"
            height="3rem"
            padding="0 1rem"
            borderRadius="sm"
            display="flex"
        >
            <Box>
                <strong>{name}</strong> | {pages}
            </Box>
            <Box marginLeft="auto">Price:</Box>
        </Box>
    );
};

export default UploadCard;
