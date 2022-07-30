import React from 'react'
import {
    Box,
    Heading,
    Image,
    IconButton,
    ButtonGroup
} from '@chakra-ui/react'
import {
    HamburgerIcon
} from '@chakra-ui/icons'
import styles from './NavBar.module.css'
import InstagramIcon from '../Icons/InstagramIcon'
import FacebookIcon from '../Icons/FacebookIcon'
type Props = {}

export default function NavBar({ }: Props) {
    const [menuOpened, setMenuOpened] = React.useState<boolean>(false);
    const handleMenuOpen = () => {
        setMenuOpened(!menuOpened);
    }
    return (
        <Box
            display="flex"
            height="4rem"
            width="100vw"
            backgroundColor="brown.100"
            position="fixed"
            top="0"
            zIndex="999"
            left="0"
            boxShadow="0 0 10px black"
            padding="0 2rem"
            alignItems="center">
            <Image
                cursor="pointer"
                height="3rem"
                width="auto"
                src='/primallogo.png'
                alt='logo'>
            </Image>
            <span className={styles.mobileicon}>
                <IconButton
                    icon={<HamburgerIcon />}
                    aria-label='mobilemenu'
                    onClick={() => handleMenuOpen()}
                    variant="unstyled"
                    size="lg"
                    _hover={{
                        color: "brown.700"
                    }}
                />
            </span>
            <ul className={`${styles.navigationitems} ${menuOpened && styles.opened}`}>
                <li>
                    <Heading size="sm" fontWeight="500">About</Heading>
                </li>
                <li>
                    <Heading size="sm" fontWeight="500">Contact</Heading>
                </li>
                <li>
                    <Heading size="sm" fontWeight="500">Shop</Heading>
                </li>

            </ul>
            <ButtonGroup
                marginLeft="auto">
                <IconButton
                    icon={<InstagramIcon />}
                    aria-label='instagram'
                    variant="unstyled"
                    color="#C3B4B1"
                    size="lg"
                    _hover={{
                        color: "brown.700"
                    }}
                />
                <IconButton
                    icon={<FacebookIcon />}
                    aria-label='facebook'
                    variant="unstyled"
                    color="#C3B4B1"
                    size="lg"
                    _hover={{
                        color: "brown.700"
                    }}
                />
            </ButtonGroup>
        </Box>
    )
}