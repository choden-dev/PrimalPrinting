import { useEffect } from "react";

/**
 * OAuth callback landing page — used when sign-in opens in a popup.
 * Closes the popup and triggers a session refresh in the parent window.
 */
export default function AuthCallback() {
	useEffect(() => {
		// Notify the parent window to refresh session
		if (window.opener) {
			window.opener.focus();
			window.close();
		} else {
			// Fallback: if not opened as popup, redirect to order page
			window.location.href = "/order";
		}
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
			Signing you in...
		</div>
	);
}
