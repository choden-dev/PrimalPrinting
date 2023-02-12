import '../styles/globals.css'
import {
  ChakraProvider,

} from '@chakra-ui/react'
import { MessengerChat } from 'react-messenger-chat-plugin'
import theme from '../styles/theme'
import type { AppProps } from 'next/app'

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <ChakraProvider theme={theme}>
        <Component {...pageProps} />
      </ChakraProvider>

    </>

  )
}

export default MyApp
