import {
	Accordion,
	AccordionButton,
	AccordionIcon,
	AccordionItem,
	AccordionPanel,
	Box,
	Heading,
	Image,
	Link,
	ListItem,
	Text,
	UnorderedList,
	useMediaQuery,
} from "@chakra-ui/react";
import type { ReactNode } from "react";
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

const Highlighted = ({ children }: { children: ReactNode }) => {
	return (
		<Text as="span" color="brown.800">
			{children}
		</Text>
	);
};

const ExtraInfo = () => {
	const [smallScreen] = useMediaQuery("(max-width: 700px)");
	return (
		<>
			<Box display="flex" justifyContent="flex-start">
				<Box
					borderColor="brown.700"
					borderWidth="1px"
					display="flex"
					flexDir={smallScreen ? "column" : "row"}
					alignItems="center"
					gap="1rem"
					bg="white"
					borderRadius="sm"
					marginTop="1rem"
					padding="1rem"
				>
					<Image maxHeight="7rem" src="/cheaperwithafriendgraphic.png" />
					<Box display="flex" flexDir="column" fontWeight="900">
						<Heading>
							<Highlighted>CHEAPER</Highlighted> WITH A FRIEND
						</Heading>
						<Text>
							Get a <Highlighted>{getPercentOff()}%</Highlighted> discount off
							coursebooks you order{" "}
							<Highlighted>{getMinimumItemsForDiscount()}</Highlighted> or more
							of...{" "}
						</Text>
						<Text>
							So if you have friends (must be nice){" "}
							<Highlighted>ORDER TOGETHER AND SAVE $$</Highlighted>
						</Text>
					</Box>
				</Box>
			</Box>
			<HelpAccordion />
		</>
	);
};

export default ExtraInfo;
