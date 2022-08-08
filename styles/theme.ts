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
            700: '#c99e87',
            200: '#C3B4B1',
            100: '#F3EBE3'
        }
    },
    styles: {
        global: {
            body: {
                bg: 'rgb(251,251,251)'
            }
        }
    },
    components: {
        Button: {
            variants: {
                'browned': {
                    bg: 'brown.700',
                    color: 'white',
                    borderRadius: 'sm',
                    _hover: {
                        bg: 'brown.800'
                    }
                }
            }
        }
    }
})

export default theme