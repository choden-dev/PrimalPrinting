"use client";

import Link from "next/link";

/**
 * Custom nav links injected into the Payload admin sidebar.
 * Adds quick access to custom admin views.
 */
export default function AdminNavLinks() {
	const linkStyle: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		gap: "8px",
		padding: "8px 16px",
		fontSize: "14px",
		color: "var(--theme-text)",
		textDecoration: "none",
		borderRadius: "4px",
		transition: "background 0.15s ease",
	};

	const handleMouseEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
		e.currentTarget.style.background = "var(--theme-elevation-100, #f5f5f5)";
	};
	const handleMouseLeave = (e: React.MouseEvent<HTMLAnchorElement>) => {
		e.currentTarget.style.background = "transparent";
	};

	return (
		<>
			<Link
				href="/admin/verify-payments"
				style={linkStyle}
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
			>
				🧾 Verify Payments
			</Link>
			<Link
				href="/admin/orders-by-timeslot"
				style={linkStyle}
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
			>
				📦 Orders by Timeslot
			</Link>
			<Link
				href="/admin/notify-timeslots"
				style={linkStyle}
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
			>
				📧 Notify Timeslots
			</Link>
		</>
	);
}
