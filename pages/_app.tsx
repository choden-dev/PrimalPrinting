import "../styles/globals.css";
import { ChakraProvider } from "@chakra-ui/react";
import type { AppProps } from "next/app";
import { GoogleAnalytics } from "nextjs-google-analytics";
import { AuthProvider } from "../contexts/AuthContext";
import theme from "../styles/theme";

function MyApp({ Component, pageProps }: AppProps) {
	return (
		<>
			<GoogleAnalytics />
			<AuthProvider>
				<ChakraProvider theme={theme}>
					<Component {...pageProps} />
				</ChakraProvider>
			</AuthProvider>
		</>
	);
}

export default MyApp;
