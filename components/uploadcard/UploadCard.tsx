import { CloseIcon } from "@chakra-ui/icons";
import { Box, IconButton, Input, Select } from "@chakra-ui/react";

const UploadCard = ({
    name,
    pages,
    price,
    removeFunction,
    changeFunction,
}: {
    name: string;
    pages: number;
    price: number;
    removeFunction: (name: string) => any;
    changeFunction: (option: boolean, name: string) => any;
}) => {
    return (
        <Box
            bg="white"
            height="fit-content"
            padding="1rem"
            borderRadius="sm"
            onClick={(e) => e.stopPropagation()}
            display="flex"
            flexDir="column"
        >
            <Box display="flex" w="100%" alignItems="center">
                <Box>
                    Filename: <strong>{name}</strong> | {pages} Pages
                </Box>
                <Box marginLeft="auto">Price: ${price}</Box>
                <IconButton
                    aria-label="remove from uploads"
                    icon={<CloseIcon />}
                    variant={"unstyled"}
                    onClick={(e) => {
                        e.stopPropagation();
                        removeFunction(name);
                    }}
                />
            </Box>

            <Select
                defaultValue="B/W"
                onChange={(e) => {
                    if (e.target.value === "B/W") changeFunction(false, name);
                    else changeFunction(true, name);
                }}
                borderRadius="sm"
            >
                <option value="Colour">Colour</option>
                <option value="B/W">B/W</option>
            </Select>
        </Box>
    );
};

export default UploadCard;
