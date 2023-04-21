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
            height="3rem"
            padding="0 1rem"
            borderRadius="sm"
            display="flex"
            gap="1rem"
        >
            <Box>
                Filename: <strong>{name}</strong> | {pages} Pages
            </Box>
            <Box marginLeft="auto">Price: {price}</Box>
            <Select
                defaultValue="B/W"
                onChange={(e) => {
                    if (e.target.value === "B/W") changeFunction(false, name);
                    else changeFunction(true, name);
                }}
                borderRadius="sm"
                maxW="6.2rem"
            >
                <option value="Colour">Colour</option>
                <option value="B/W">B/W</option>
            </Select>
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
    );
};

export default UploadCard;
