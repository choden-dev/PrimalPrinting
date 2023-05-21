import { Box, FormLabel, Heading, Input, Textarea } from "@chakra-ui/react";
type Props = {
    formRef: any;
};
const DetailsForm = ({ formRef }: Props) => {
    return (
        <>
            <Box display="flex" flexDir="column" gap="1rem" padding="0 1rem">
                <Heading>Your Details</Heading>
                <form ref={formRef}>
                    <Box
                        display="grid"
                        gridTemplateColumns="1fr 1fr"
                        columnGap="1rem"
                    >
                        <FormLabel>Name</FormLabel>
                        <FormLabel>Email</FormLabel>
                        <Input
                            isRequired
                            name="name"
                            minLength={2}
                            type="text"
                            borderRadius="sm"
                        />
                        <Input name="email" type="email" borderRadius="sm" />
                    </Box>
                    <FormLabel>Extra requests</FormLabel>
                    <Textarea name="message" type="text" borderRadius="sm" />
                </form>
            </Box>
        </>
    );
};

export default DetailsForm;
