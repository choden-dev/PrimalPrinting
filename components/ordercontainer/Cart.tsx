import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Divider,
  Heading,
  List,
  ListItem,
  Text,
} from "@chakra-ui/react";
import { CartContext } from "../../contexts/CartContext";
import CartItem from "../../types/models/CartItem";
import QuantityPicker from "../quantitypicker/QuantityPicker";
import { useContext } from "react";
import { getPercentOff } from "../../lib/utils";

type Props = {
  smallScreen: boolean;
  formRef: any;
};

const CartItemContainer = () => {
  const { cartPackages, removeCartPackage, updateCartPackage } =
    useContext(CartContext);

  return (
    <>
      {cartPackages.map((cartPackage: CartItem) => {
        return (
          <ListItem key={cartPackage.id}>
            <Box
              display="flex"
              border="1px solid"
              borderColor="brown.700"
              padding="1rem"
              borderRadius="sm"
              marginBottom=".5rem"
            >
              <Text>
                {cartPackage.displayName} |{" "}
                <strong>${cartPackage.getDisplayPrice().toFixed(2)}</strong>
              </Text>
              <Box
                marginLeft="auto"
                display="flex"
                gap="1rem"
                alignItems="center"
              >
                {cartPackage.shouldApplyDiscount() && (
                  <Badge colorScheme="green">{getPercentOff()}% off!</Badge>
                )}
                <QuantityPicker
                  defaultValue={cartPackage.getQuantity()}
                  onChange={(_, value) => {
                    cartPackage.setQuantity(value);
                    updateCartPackage(cartPackage);
                  }}
                />
                <Text
                  marginLeft="auto"
                  fontWeight="800"
                  cursor="pointer"
                  onClick={() => {
                    removeCartPackage(cartPackage);
                  }}
                >
                  X
                </Text>
              </Box>
            </Box>
          </ListItem>
        );
      })}
    </>
  );
};

const PdfItemContainer = () => {
  const { uploadedPdfs, updateUploadedPdf, removeUploadedPdf } =
    useContext(CartContext);
  return (
    <>
      {uploadedPdfs && (
        <>
          <Heading as="span" fontSize="1rem">
            Uploaded Files
          </Heading>
          <Divider marginBottom=".5rem" />
          {uploadedPdfs.map((pdf) => {
            return (
              <ListItem key={pdf.id} marginBottom=".5rem">
                <Box
                  display="flex"
                  border="1px solid"
                  borderColor="brown.700"
                  padding="1rem"
                  borderRadius="sm"
                  marginBottom=".5rem"
                >
                  <Text>
                    {pdf.displayName} |{" "}
                    <strong>${pdf.getDisplayPrice().toFixed(2)}</strong>
                  </Text>
                  <Box
                    marginLeft="auto"
                    display="flex"
                    gap="1rem"
                    alignItems="center"
                  >
                    {pdf.shouldApplyDiscount() && (
                      <Badge colorScheme="green">{getPercentOff()}% off!</Badge>
                    )}
                    <QuantityPicker
                      defaultValue={pdf.getQuantity()}
                      onChange={(_, value) => {
                        pdf.setQuantity(value);
                        updateUploadedPdf(pdf);
                      }}
                    />
                    <Text
                      marginLeft="auto"
                      fontWeight="800"
                      cursor="pointer"
                      onClick={() => {
                        removeUploadedPdf(pdf);
                      }}
                    >
                      X
                    </Text>
                  </Box>
                </Box>
              </ListItem>
            );
          })}
        </>
      )}
    </>
  );
};

const Cart = ({ smallScreen, formRef }: Props) => {
  const {
    cartPackages,
    uploadedPdfs,
    displayPriceString,
    setIsModalOpen,
    hasDiscountApplied,
  } = useContext(CartContext);
  const checkFormValidity = () => {
    const form = formRef.current;
    const formValid = form.checkValidity();
    if (!formValid) window.alert("Please check your submission details.");
    return formValid;
  };

  const checkCartValidity = () => {
    const cartValid =
      (cartPackages && cartPackages.length !== 0) ||
      (uploadedPdfs && uploadedPdfs.length !== 0);
    if (!cartValid) window.alert("Please choose a package or upload a pdf.");
    return cartValid;
  };

  return (
    <Box
      w="100%"
      bg="white"
      h="fit-content"
      position={smallScreen ? "relative" : "sticky"}
      padding="1rem .5rem"
      border="1px"
      color="brown.900"
      borderColor="brown.200"
      top={smallScreen ? "0" : "5rem"}
    >
      <Box display="flex" flexDir="column">
        <Heading fontSize="1.5rem" as="p">
          Your Items
        </Heading>
        <p>
          click the <strong>X</strong> on the right of an item to remove
        </p>
        <List>
          <Text fontWeight="800">Packages</Text>
          <Divider marginBottom=".5rem" />
          <CartItemContainer />
          <PdfItemContainer />
          <ListItem>
            <Text fontSize="1.5rem">
              <strong>Estimated Price: ${displayPriceString}</strong>
            </Text>
          </ListItem>
          <Button
            variant="browned"
            onClick={() => {
              if (checkCartValidity() && checkFormValidity())
                setIsModalOpen(true);
            }}
          >
            Order Now
          </Button>
        </List>
      </Box>
    </Box>
  );
};

export default Cart;
