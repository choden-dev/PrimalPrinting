import type { Session } from "next-auth";
import { SessionProvider, signIn, signOut, useSession } from "next-auth/react";
import {
	createContext,
	type PropsWithChildren,
	useContext,
	useMemo,
} from "react";

// ── Extended session type ────────────────────────────────────────────────

declare module "next-auth" {
	interface Session {
		customerId?: string;
	}
}

interface CustomerSession {
	/** Whether the user is currently authenticated */
	isAuthenticated: boolean;
	/** Whether the session is still loading */
	isLoading: boolean;
	/** Payload `customers` collection ID */
	customerId: string | null;
	/** User's display name from Google */
	name: string | null;
	/** User's email from Google */
	email: string | null;
	/** User's avatar URL from Google */
	image: string | null;
	/** Trigger Google OAuth sign-in */
	login: () => void;
	/** Sign out and clear session */
	logout: () => void;
}

const AuthContext = createContext<CustomerSession>({
	isAuthenticated: false,
	isLoading: true,
	customerId: null,
	name: null,
	email: null,
	image: null,
	login: () => {},
	logout: () => {},
});

// ── Inner provider (must be inside SessionProvider) ──────────────────────

function AuthContextInner({ children }: PropsWithChildren) {
	const { data: session, status } = useSession();

	const value = useMemo<CustomerSession>(() => {
		const isLoading = status === "loading";
		const isAuthenticated = status === "authenticated" && !!session;

		return {
			isAuthenticated,
			isLoading,
			customerId: (session as Session)?.customerId ?? null,
			name: session?.user?.name ?? null,
			email: session?.user?.email ?? null,
			image: session?.user?.image ?? null,
			login: () => signIn("google"),
			logout: () => signOut({ callbackUrl: "/" }),
		};
	}, [session, status]);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Exported provider & hook ─────────────────────────────────────────────

/**
 * Wrap your app (or the order pages) with this provider to enable
 * customer authentication via Google OAuth.
 *
 * ```tsx
 * <AuthProvider>
 *   <App />
 * </AuthProvider>
 * ```
 */
export function AuthProvider({ children }: PropsWithChildren) {
	return (
		<SessionProvider>
			<AuthContextInner>{children}</AuthContextInner>
		</SessionProvider>
	);
}

/**
 * Access the current customer's authentication state.
 *
 * ```tsx
 * const { isAuthenticated, customerId, login, logout } = useAuth();
 * ```
 */
export function useAuth(): CustomerSession {
	return useContext(AuthContext);
}
