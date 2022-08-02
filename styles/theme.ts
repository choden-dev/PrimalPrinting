// theme.js

// 1. import `extendTheme` function
import { extendTheme, type ThemeConfig } from '@chakra-ui/react'

// 2. Add your color mode config
const config: ThemeConfig = {
    initialColorMode: 'light',
    useSystemColorMode: false,

}

// 3. extend the theme
const theme = extendTheme({
    config,
    colors: {
        brown: {
            900: '#452821',
            800: '#672212',
            700: '#BC6850',
            200: '#C3B4B1',
            100: '#F3EBE3'
        }
    },
    components: {
        Button: {
            variants: {
                'browned': {
                    bg: 'brown.200',
                    color: 'white',
                    borderRadius: 'sm',
                    _hover: {
                        bg: 'brown.700'
                    }
                }
            }
        }
    }
})

export default theme