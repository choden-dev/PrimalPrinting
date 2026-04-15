import { HamburgerIcon } from "@chakra-ui/icons";
import {
	Avatar,
	Box,
	Button,
	Heading,
	IconButton,
	Image,
	Menu,
	MenuButton,
	MenuItem,
	MenuList,
	Text,
} from "@chakra-ui/react";
import Link from "next/link";
import React from "react";
import { useAuth } from "../../contexts/AuthContext";
import SocialLinks from "../sociallinks/sociallinks";
import styles from "./NavBar.module.css";

function UserMenu() {
	const { isAuthenticated, isLoading, name, image, login, logout } = useAuth();

	if (isLoading) return null;

	if (!isAuthenticated) {
		return (
			<Button
				size="sm"
				variant="outline"
				colorScheme="brown"
				ml={3}
				onClick={login}
			>
				Sign in
			</Button>
		);
	}

	return (
		<Menu>
			<MenuButton ml={3}>
				<Avatar size="sm" name={name || ""} src={image || undefined} />
			</MenuButton>
			<MenuList zIndex={10000}>
				<Box px={3} py={2}>
					<Text fontWeight={600} fontSize="sm">
						{name}
					</Text>
				</Box>
				<Link href="/my-orders">
					<MenuItem fontSize="sm">My Orders</MenuItem>
				</Link>
				<MenuItem fontSize="sm" onClick={logout} color="red.500">
					Sign out
				</MenuItem>
			</MenuList>
		</Menu>
	);
}

export default function NavBar() {
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
			<Box marginLeft="auto" display="flex" alignItems="center">
				<ul
					className={`${styles.navigationitems} ${menuOpened && styles.opened}`}
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
				<UserMenu />
			</Box>
		</Box>
	);
}
