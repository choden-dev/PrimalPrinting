import React from "react";
import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalCloseButton,
    Image,
    Heading,
    Text,
    Box,
    Button,
    Stack,
    useMediaQuery,
    Select,
    useDisclosure,
} from "@chakra-ui/react";

type Props = {
    isOpen: boolean;
    closeFunction: () => any;
    creditCard: () => any;
    bankTransfer: () => any;
};

export default function ItemModal({
    isOpen,
    closeFunction,
    creditCard,
    bankTransfer,
}: Props) {
    const [smallScreen] = useMediaQuery("(max-width:900px)");
    return (
        <Modal isOpen={isOpen} onClose={closeFunction} size="xl">
            <ModalOverlay zIndex="999" overflow="auto" />

            <ModalContent
                color="brown.900"
                padding="2rem"
                margin="auto"
                maxW="800px"
                minH="70%"
                justifyContent="center"
                borderRadius="sm"
                sx={{
                    "@media only screen and (max-width: 900px)": {
                        marginTop: "5rem",
                        marginBottom: "1rem",
                    },
                }}
            >
                <ModalCloseButton />
                <Box
                    display="flex"
                    sx={{
                        "@media only screen and (max-width: 900px)": {
                            flexDir: "column",
                            gap: "1.5rem",
                        },
                    }}
                    gap="2.5rem"
                >
                    <Box
                        overflow="hidden"
                        maxW="100%"
                        boxShadow="0.3rem 0.3rem 0 #672212"
                        sx={{
                            "@media only screen and (max-width:900px)": {
                                maxHeight: "15rem",
                                boxShadow: "none",
                            },
                        }}
                    ></Box>
                    <Box display="flex" gap="1rem" flexDir="column">
                        <ModalHeader padding="0" fontSize="4xl">
                            Choose an option
                        </ModalHeader>
                        <Text>
                            Choose an option from below to proceed with your
                            order.
                        </Text>

                        <Button
                            onClick={() => bankTransfer()}
                            marginTop="auto"
                            variant="browned"
                        >
                            Pay via bank transfer
                        </Button>
                        <Button
                            onClick={() => creditCard()}
                            marginTop="auto"
                            variant="browned"
                        >
                            Pay via credit card
                        </Button>
                    </Box>
                </Box>
            </ModalContent>
        </Modal>
    );
}
