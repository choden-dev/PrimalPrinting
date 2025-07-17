import { SunIcon } from "@chakra-ui/icons";
import { Box, Heading, Link } from "@chakra-ui/react";
import NextLink from "next/link";
import React from "react";
import styles from "./WhatNextDiv.module.css";

export default function WhatNextDiv() {
	return (
		<Box
			border="1px"
			borderColor="brown.200"
			display="flex"
			textAlign={{ base: "center", md: "left" }}
			alignItems="center"
			justifyContent="center"
			gap="2rem"
			flexWrap="wrap"
			padding="2rem"
			bg="white"
			width="100vw"
			transform="translateX(-7%)"
			overflow="visible"
			position="relative"
		>
			<Box
				position="absolute"
				transformOrigin="top right"
				transform="rotate(90deg)"
				right="0"
				h="70%"
				w="4.5rem"
				bgImage="binder.png"
				top="2.7rem"
				bgRepeat="no-repeat"
			></Box>
			<SunIcon w={"5rem"} h={"5rem"} color="brown.800" />

			<Box display="flex" flexDir="column" gap="0.5rem">
				<Heading size="4xl" fontWeight="400">
					Like what you see?
				</Heading>
				<Heading fontWeight="300">
					Feel free to&nbsp;
					<NextLink href="/contact" passHref>
						<Link
							_hover={{
								textDecor: "none",
							}}
							className={styles.endlink}
							as="a"
							color="brown.700"
							fontWeight="400"
						>
							Contact me
						</Link>
					</NextLink>
				</Heading>
			</Box>
		</Box>
	);
}
