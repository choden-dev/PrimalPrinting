import React from 'react'
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
    Select
} from '@chakra-ui/react'

type Props = {
    close: () => void;
    isOpen: boolean;
    imageUrl: string;
    description: string;
    name: string;
}

export default function ItemModal({ close, isOpen, imageUrl, description, name }: Props) {
    const [smallScreen] = useMediaQuery('(max-width:900px)');
    return (
        <Modal isOpen={isOpen} size="xl" onClose={() => close()}
        >
            <ModalOverlay
                overflow="auto" />

            <ModalContent
                color="brown.900"
                padding="2rem"
                margin="auto"
                maxW="800px"
                minH="70%"
                justifyContent="center"
                borderRadius="sm"
                sx={{
                    '@media only screen and (max-width: 900px)': {
                        marginTop: "5rem",
                        marginBottom: "1rem"
                    }
                }}>
                <ModalCloseButton />
                <Box
                    display="flex"
                    sx={{
                        '@media only screen and (max-width: 900px)': {
                            flexDir: "column",
                            gap: '1.5rem'
                        }
                    }}
                    gap="2.5rem">
                    <Box
                        overflow="hidden"
                        maxW="100%"
                        boxShadow="0.3rem 0.3rem 0 #672212"
                        sx={{
                            '@media only screen and (max-width:900px)': {
                                maxHeight: "15rem",
                                boxShadow: "none"
                            }
                        }}>
                        <Image src={imageUrl}
                            width={smallScreen ? "100%" : ""}
                            alt=""
                        />
                    </Box>
                    <Box display="flex"
                        gap="1rem"
                        flexDir="column">
                        <ModalHeader padding="0" fontSize="4xl" >{name}</ModalHeader>
                        <Text >Lorem ipsum dolor sit amet consectetur adipisicing elit. Iusto, animi officia deleniti repellendus totam reprehenderit quia reiciendis sint quae aspernatur.</Text>
                        <Stack dir="column">
                            <Select placeholder="pages" required>
                                <option value="100">100</option>
                                <option value="200">200</option>
                                <option value="300">300</option>
                            </Select>
                            <Select placeholder="size" required>
                                <option value="A4">A4</option>
                                <option value="A3">A3</option>
                                <option value="A2">A2</option>
                                <option value="A1">A1</option>
                            </Select>
                        </Stack>
                        <Stack dir="column">
                            <Text>Price:</Text>
                            <Heading>$69</Heading>
                        </Stack>
                        <Button marginTop="auto"
                            variant="browned">Buy</Button>
                    </Box>
                </Box>
            </ModalContent>
        </Modal>
    )
}