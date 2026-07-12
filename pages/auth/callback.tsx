import { useEffect } from "react";

/**
 * OAuth callback page: after Google/NextAuth sign-in, redirects the user back
 * to the saved return URL from sessionStorage (defaulting to /order).
 */
export default function AuthCallback() {
	useEffect(() => {
		const returnUrl = sessionStorage.getItem("auth-return-url") || "/order";
		sessionStorage.removeItem("auth-return-url");
		window.location.replace(returnUrl);
	}, []);

	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				height: "100vh",
				fontFamily: "sans-serif",
				color: "#666",
			}}
		>
			Signing you in…
		</div>
	);
}
