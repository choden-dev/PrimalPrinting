import "../styles/globals.css";
import { ChakraProvider } from "@chakra-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AppProps } from "next/app";
import { GoogleAnalytics } from "nextjs-google-analytics";
import { useState } from "react";
import { AuthProvider } from "../contexts/AuthContext";
import theme from "../styles/theme";

function MyApp({ Component, pageProps }: AppProps) {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						staleTime: 30 * 1000, // 30 seconds
						retry: 1,
					},
				},
			}),
	);

	return (
		<>
			<GoogleAnalytics />
			<QueryClientProvider client={queryClient}>
				<AuthProvider>
					<ChakraProvider theme={theme}>
						<Component {...pageProps} />
					</ChakraProvider>
				</AuthProvider>
			</QueryClientProvider>
		</>
	);
}

export default MyApp;
