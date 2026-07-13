"use client";

import { useDocumentInfo } from "@payloadcms/ui";
import Link from "next/link";

/**
 * Payload admin button shown on a Customer's edit view. Deep-links the admin to
 * the "Create Order for Customer" view with this customer pre-selected
 * (?customerId=<id>), so they can go straight to uploading the customer's files
 * and putting the order into the payment stage.
 */
export const CreateOrderForCustomerButton: React.FC = () => {
	const { id } = useDocumentInfo();

	// No id means this is the "create new customer" screen — nothing to link to.
	if (!id) return null;

	const href = `/admin/create-order?customerId=${encodeURIComponent(String(id))}`;

	return (
		<div
			style={{
				padding: "16px",
				marginBottom: "16px",
				background: "#e3f2fd",
				borderRadius: "8px",
				border: "2px solid #1976d2",
			}}
		>
			<h4 style={{ margin: "0 0 8px", color: "#1565c0" }}>
				🖨️ Create an order for this customer
			</h4>
			<p style={{ margin: "0 0 12px", fontSize: "14px", color: "#666" }}>
				Manually upload this customer's files and put them into the payment
				stage — useful when they couldn't upload on the site themselves.
			</p>
			<Link
				href={href}
				style={{
					display: "inline-block",
					background: "#1976d2",
					color: "#fff",
					padding: "10px 24px",
					borderRadius: "6px",
					fontSize: "14px",
					fontWeight: 600,
					textDecoration: "none",
				}}
			>
				➕ Create order for this customer
			</Link>
		</div>
	);
};

export default CreateOrderForCustomerButton;
