import { Box, Image, Link, Text } from "@chakra-ui/react";
import styles from "./IntroAnimation.module.css";

const IntroAnimation = () => {
	return (
		<>
			<Box
				position="sticky"
				className={styles.background_gradient}
				marginLeft="-8%"
				top="4rem"
				justifyContent={"center"}
				width="100vw"
				h="100vh"
				display="flex"
			>
				<Box className={styles.landing_container}>
					<Image
						zIndex="-1"
						overflow="visible"
						className={styles.glowing_image}
						objectFit="cover"
						src="/intro.png"
						h="100%"
						w="auto"
					/>
					<Box display="flex" flexDir="column" height="100%">
						<Box className={styles.landing_text}>
							<Image src="/LandingTextFull.svg" />
							<Text
								className={styles.info_text}
								fontWeight="700"
								color="brown.800"
								fontSize="sm"
							>
								<Link href="/order">Order Now</Link> or{" "}
								<Link href="#about">scroll down</Link> to find out more...
							</Text>
						</Box>
					</Box>
				</Box>
			</Box>
		</>
	);
};

export default IntroAnimation;
