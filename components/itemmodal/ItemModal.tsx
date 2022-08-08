import React from 'react'
import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    Image,
    Heading,
    Text,
    Box,
    Accordion,
    AccordionIcon,
    AccordionItem,
    AccordionButton,
    AccordionPanel
} from '@chakra-ui/react'
type Props = {
    close: () => void;
    open: () => void;
    isOpen: boolean;
}

export default function ItemModal({ close, open, isOpen }: Props) {
    return (
        <Modal isOpen={isOpen} size="xl" onClose={() => close()}
        >
            <ModalOverlay
                overflow="auto" />

            <ModalContent
                color="brown.900"
                padding="2rem"
                margin="auto"
                borderRadius="sm">
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

                <Heading>$69</Heading>

            </ModalContent>
        </Modal>
    )
}