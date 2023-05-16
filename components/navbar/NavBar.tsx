import React from "react";
import { Box, Heading, Image, IconButton, ButtonGroup } from "@chakra-ui/react";
import { HamburgerIcon } from "@chakra-ui/icons";
import Link from "next/link";
import styles from "./NavBar.module.css";
import SocialLinks from "../sociallinks/sociallinks";
type Props = {};

export default function NavBar({}: Props) {
    const [menuOpened, setMenuOpened] = React.useState<boolean>(false);
    const handleMenuOpen = () => {
        setMenuOpened(!menuOpened);
    };
    return (
        <Box
            display="flex"
            height="4rem"
            width="100vw"
            backgroundColor="brown.100"
            position="fixed"
            top="0"
            zIndex="9999"
            left="0"
            padding="0 7%"
            borderBottom="1px"
            borderColor="brown.200"
            alignItems="center"
        >
            <Link href="/">
                <Image
                    cursor="pointer"
                    height="3rem"
                    width="auto"
                    src="/primallogo.png"
                    alt="logo"
                />
            </Link>
            <span className={styles.mobileicon}>
                <IconButton
                    icon={<HamburgerIcon />}
                    aria-label="mobilemenu"
                    onClick={() => handleMenuOpen()}
                    variant="unstyled"
                    size="lg"
                    _hover={{
                        color: "brown.700",
                    }}
                />
            </span>
            <Box marginLeft="auto" display="flex">
                <ul
                    className={`${styles.navigationitems} ${
                        menuOpened && styles.opened
                    }`}
                >
                    <li>
                        <Link href="/">
                            <Heading size="sm" fontWeight="500">
                                About
                            </Heading>
                        </Link>
                    </li>
                    <li>
                        <Link href="/order">
                            <Heading size="sm" fontWeight="500">
                                Order Now
                            </Heading>
                        </Link>
                    </li>

                    <li>
                        <Link href="/contact">
                            <Heading size="sm" fontWeight="500">
                                Contact
                            </Heading>
                        </Link>
                    </li>
                </ul>
                <SocialLinks />
            </Box>
        </Box>
    );
}
