"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";

/**
 * Provides a React Query client for Payload admin custom views.
 *
 * Payload admin views render inside the App Router (`app/(payload)`) tree,
 * which is NOT wrapped by the `QueryClientProvider` in `pages/_app.tsx`
 * (that only covers the Pages Router). Each admin view that uses React Query
 * must therefore wrap its content in this provider so a QueryClient is
 * available. Defaults are kept in sync with the Pages Router provider.
 */
export default function AdminQueryProvider({
	children,
}: {
	children: React.ReactNode;
}) {
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
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
}
