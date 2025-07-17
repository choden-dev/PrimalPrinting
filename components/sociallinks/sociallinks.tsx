import { ButtonGroup, IconButton } from "@chakra-ui/react";
import FacebookIcon from "../Icons/FacebookIcon";
import InstagramIcon from "../Icons/InstagramIcon";
export default function SocialLinks() {
	return (
		<>
			<ButtonGroup marginBottom="5px">
				<a
					target="_blank"
					rel="noreferrer noopener"
					href="https://www.instagram.com/primal.printing/"
				>
					<IconButton
						icon={<InstagramIcon />}
						aria-label="instagram"
						variant="unstyled"
						color="brown.900"
						size="lg"
						_hover={{
							color: "brown.700",
						}}
					/>
				</a>
				<a
					target="_blank"
					rel="noreferrer noopener"
					href="https://www.facebook.com/primal.printing"
				>
					<IconButton
						icon={<FacebookIcon />}
						aria-label="facebook"
						variant="unstyled"
						color="brown.900"
						size="lg"
						_hover={{
							color: "brown.700",
						}}
					/>
				</a>
			</ButtonGroup>
		</>
	);
}
