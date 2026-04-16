import { useEffect } from "react";

/**
 * OAuth callback landing page.
 *
 * After Google OAuth completes, NextAuth redirects here. This page reads the
 * saved return URL from sessionStorage and redirects the user back to where
 * they were before sign-in (e.g. the order page with their uploaded files
 * restored from IndexedDB).
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
