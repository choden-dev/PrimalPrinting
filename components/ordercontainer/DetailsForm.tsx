import { Box, FormLabel, Input, Textarea } from "@chakra-ui/react";
const DetailsForm = () => {
    return (
        <>
            <Box display="flex" flexDir="column" gap="1rem">
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
            </Box>
        </>
    );
};

export default DetailsForm;
