"use client";

import type React from "react";

/**
 * Color-coded order status badge for the Payload admin orders list view.
 */

const STATUS_COLORS: Record<
	string,
	{ bg: string; text: string; label: string }
> = {
	DRAFT: { bg: "#f5f5f5", text: "#757575", label: "Draft" },
	AWAITING_PAYMENT: {
		bg: "#fff3e0",
		text: "#e65100",
		label: "Awaiting Payment",
	},
	PAYMENT_PENDING_VERIFICATION: {
		bg: "#fff8e1",
		text: "#f57f17",
		label: "Pending Verification",
	},
	PAID: { bg: "#e8f5e9", text: "#2e7d32", label: "Paid" },
	AWAITING_PICKUP: { bg: "#e3f2fd", text: "#1565c0", label: "Awaiting Pickup" },
	PRINTED: {
		bg: "#e8eaf6",
		text: "#283593",
		label: "Printed",
	},
	PICKED_UP: { bg: "#f3e5f5", text: "#6a1b9a", label: "Picked Up" },
	EXPIRED: { bg: "#ffebee", text: "#c62828", label: "Expired" },
};

interface OrderStatusBadgeProps {
	status: string;
}

export const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({
	status,
}) => {
	const config = STATUS_COLORS[status] || {
		bg: "#f5f5f5",
		text: "#757575",
		label: status,
	};

	return (
		<span
			style={{
				display: "inline-block",
				padding: "4px 10px",
				borderRadius: "12px",
				fontSize: "12px",
				fontWeight: 600,
				backgroundColor: config.bg,
				color: config.text,
				whiteSpace: "nowrap",
			}}
		>
			{config.label}
		</span>
	);
};

export default OrderStatusBadge;
