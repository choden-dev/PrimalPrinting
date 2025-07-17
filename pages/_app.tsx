import "../styles/globals.css";
import { ChakraProvider } from "@chakra-ui/react";
import type { AppProps } from "next/app";
import { GoogleAnalytics } from "nextjs-google-analytics";
import theme from "../styles/theme";

function MyApp({ Component, pageProps }: AppProps) {
	return (
		<>
			<GoogleAnalytics />
			<ChakraProvider theme={theme}>
				<Component {...pageProps} />
			</ChakraProvider>
		</>
	);
}

export default MyApp;
