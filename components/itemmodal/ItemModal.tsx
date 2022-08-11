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
    Accordion,
    AccordionIcon,
    AccordionItem,
    AccordionButton,
    AccordionPanel,
    useMediaQuery
} from '@chakra-ui/react'
type Props = {
    close: () => void;
    isOpen: boolean;
    imageUrl: string;
}

export default function ItemModal({ close, isOpen, imageUrl }: Props) {
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
                borderRadius="sm">
                <ModalCloseButton />
                <Box
                    display="flex"
                    sx={{
                        '@media only screen and (max-width: 900px)': {
                            flexDir: "column",
                            paddingTop: "auto"
                        }
                    }}
                    gap="1.5rem">
                    <Box
                        overflow="hidden"
                        maxW="100%"
                        sx={{
                            '@media only screen and (max-width:900px)': {
                                maxHeight: "15rem"
                            }
                        }}>
                        <Image src={imageUrl}
                            width={smallScreen ? "100%" : ""}
                            alt="" />
                    </Box>
                    <Box display="flex"

                        flexDir="column">
                        <ModalHeader padding="0" fontSize="4xl" >Product </ModalHeader>
                        <Text >Lorem ipsum dolor sit amet consectetur adipisicing elit. Iusto, animi officia deleniti repellendus totam reprehenderit quia reiciendis sint quae aspernatur.</Text>
                        <Accordion allowMultiple>
                            <AccordionItem>
                                <h2>
                                    <AccordionButton>
                                        <Box flex={1} textAlign="left">
                                            love
                                        </Box>
                                        <AccordionIcon />
                                    </AccordionButton>
                                </h2>
                                <AccordionPanel pb={4}>
                                    when you
                                </AccordionPanel>
                            </AccordionItem>
                            <AccordionItem>
                                <h2>
                                    <AccordionButton>
                                        <Box flex={1} textAlign="left">
                                            love
                                        </Box>
                                        <AccordionIcon />
                                    </AccordionButton>
                                </h2>
                                <AccordionPanel pb={4}>
                                    when you

                                </AccordionPanel>
                            </AccordionItem>
                        </Accordion>
                        <Text>Estimated Price:</Text>
                        <Heading>$69</Heading>
                        <Button marginTop="auto"
                            variant="browned">Buy</Button>
                    </Box>
                </Box>
            </ModalContent>
        </Modal>
    )
}