import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Alert,
  AlertIcon,
  Box,
  Link,
  ListItem,
  UnorderedList,
} from "@chakra-ui/react";
import { ReactNode } from "react";
import { getMinimumItemsForDiscount, getPercentOff } from "../../lib/utils";
const AccordionItemComponent = ({
  children,
  title,
}: {
  title: string;
  children: ReactNode;
}) => (
  <AccordionItem>
    <AccordionButton>
      <Box as="span" flex="1" textAlign="left">
        {title}
      </Box>
      <AccordionIcon />
    </AccordionButton>
    <AccordionPanel>{children}</AccordionPanel>
  </AccordionItem>
);

const HelpAccordion = () => (
  <Accordion marginTop=".5rem" allowToggle allowMultiple>
    <AccordionItemComponent title="I want to send a PDF (coursebook, lab manual etc) for printing">
      <UnorderedList>
        <ListItem>
          Click on <strong>Upload Pdf</strong>
        </ListItem>
        <ListItem>
          Click the <strong>+</strong>(plus) or drag your PDF file into the box
        </ListItem>
        <ListItem>Wait for the upload to finish</ListItem>
      </UnorderedList>
    </AccordionItemComponent>

    <AccordionItemComponent title="I want to finalize my order">
      <UnorderedList>
        <ListItem>
          Fill in your <strong>name</strong>, <strong>email</strong>, and add
          any extra requests (optional) and click the <strong>Order Now</strong>{" "}
          button
        </ListItem>
        <ListItem>
          Choose either the <strong>Pay via bank transfer</strong> or{" "}
          <strong>Pay via credit card</strong> option
        </ListItem>
        <br />
        <p>
          <strong>Pay via credit card</strong> will take you to a 3rd party
          vendor which will process the payment, while{" "}
          <strong>Pay via bank transfer</strong> will require you to keep your{" "}
          <strong>order code</strong> that will be provided on the page you are
          directed to.
        </p>
      </UnorderedList>
    </AccordionItemComponent>
    <AccordionItemComponent title="I need more help">
      <p>
        Please scroll to the bottom of the site and contact us through the given
        social media, phone, or email, or{" "}
        <Link color={"brown.700"} href="/contact">
          contact us
        </Link>
      </p>
    </AccordionItemComponent>
  </Accordion>
);
const ExtraInfo = () => {
  return (
    <>
      <Alert marginY=".5rem" status="info">
        <AlertIcon />
        You can get a {getPercentOff()}% discount if you purchase{" "}
        {getMinimumItemsForDiscount()} or more of the same item!
      </Alert>
      <HelpAccordion />
    </>
  );
};

export default ExtraInfo;
