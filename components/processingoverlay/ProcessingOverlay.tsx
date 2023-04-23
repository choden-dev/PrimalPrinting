import { Box, Spinner, Text } from "@chakra-ui/react";
export default function ProcessingOverlay() {
    return (
        <>
            <Box
                opacity="0.7"
                top="0"
                left="0"
                h="100vh"
                w="100vw"
                display="flex"
                pos="fixed"
                justifyContent="center"
                alignItems="center"
                flexDir="column"
                zIndex="1000"
                bg="rgb(33,33,33)"
            >
                <Spinner
                    h="20rem"
                    w="20rem"
                    thickness="1rem"
                    color="brown.700"
                />
                <Text fontSize="2rem" color="white">
                    Currently processing your order... This might take up to a
                    minute.
                </Text>
            </Box>
        </>
    );
}
