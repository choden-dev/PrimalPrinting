import { getPayloadClient } from "./payload";

interface BankTransferEligibility {
	eligible: true;
}

interface BankTransferIneligible {
	eligible: false;
	error: string;
	status: number;
}

type BankTransferCheck = BankTransferEligibility | BankTransferIneligible;

/**
 * Check whether a customer is eligible to submit a bank transfer for a given order.
 *
 * Validates:
 * 1. The order exists and belongs to the customer
 * 2. The order is in DRAFT or AWAITING_PAYMENT status
 * 3. The customer doesn't already have a PAYMENT_PENDING_VERIFICATION order
 */
export async function checkBankTransferEligibility(
	customerId: string,
	orderIdentifier: { orderId?: string; orderNumber?: string },
): Promise<BankTransferCheck> {
	const payload = await getPayloadClient();

	// Find the order by ID or order number
	let orderDocs: { status?: string; id: string | number; orderNumber?: string }[];

	if (orderIdentifier.orderId) {
		try {
			const order = await payload.findByID({
				collection: "orders",
				id: orderIdentifier.orderId,
			});
			orderDocs = order ? [order] : [];
		} catch {
			orderDocs = [];
		}
	} else if (orderIdentifier.orderNumber) {
		const result = await payload.find({
			collection: "orders",
			where: { orderNumber: { equals: orderIdentifier.orderNumber } },
			limit: 1,
		});
		orderDocs = result.docs;
	} else {
		return {
			eligible: false,
			error: "Order identifier required.",
			status: 400,
		};
	}

	if (orderDocs.length === 0) {
		return { eligible: false, error: "Order not found.", status: 404 };
	}

	const order = orderDocs[0];

	// Verify ownership
	const rawCustomer = (order as Record<string, unknown>).customer;
	const orderCustomerId =
		typeof rawCustomer === "object" && rawCustomer !== null
			? (rawCustomer as { id: string }).id
			: rawCustomer;

	if (orderCustomerId !== customerId) {
		return { eligible: false, error: "Order not found.", status: 404 };
	}

	// Check order status
	if (order.status !== "DRAFT" && order.status !== "AWAITING_PAYMENT") {
		return {
			eligible: false,
			error: `Cannot submit bank transfer for order in ${order.status} status.`,
			status: 400,
		};
	}

	// Check for existing pending verification
	const existingPending = await payload.find({
		collection: "orders",
		where: {
			customer: { equals: customerId },
			status: { equals: "PAYMENT_PENDING_VERIFICATION" },
		},
		limit: 1,
	});

	if (existingPending.docs.length > 0) {
		const pendingOrder = existingPending.docs[0];
		return {
			eligible: false,
			error: `You already have an order (${pendingOrder.orderNumber}) pending bank transfer verification. Please wait for it to be verified before submitting another.`,
			status: 400,
		};
	}

	return { eligible: true };
}
