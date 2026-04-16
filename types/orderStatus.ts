/**
 * Order status constants — shared between frontend and backend.
 *
 * State machine:
 * DRAFT → AWAITING_PAYMENT → PAID → AWAITING_PICKUP → PRINTED → PICKED_UP
 *                          ↘ EXPIRED
 *
 * Bank transfer orders go directly to PAID after proof is uploaded.
 * Admin can optionally verify (bankTransferVerified flag) for record keeping.
 */
export const OrderStatus = {
	DRAFT: "DRAFT",
	AWAITING_PAYMENT: "AWAITING_PAYMENT",
	PAID: "PAID",
	AWAITING_PICKUP: "AWAITING_PICKUP",
	PRINTED: "PRINTED",
	PICKED_UP: "PICKED_UP",
	EXPIRED: "EXPIRED",
} as const;

export type OrderStatusValue = (typeof OrderStatus)[keyof typeof OrderStatus];

/** Statuses that indicate the order has been paid for */
export const PAID_STATUSES: OrderStatusValue[] = [
	OrderStatus.PAID,
	OrderStatus.AWAITING_PICKUP,
	OrderStatus.PRINTED,
	OrderStatus.PICKED_UP,
];

/** Statuses where the user can still resume/continue the order */
export const RESUMABLE_STATUSES: OrderStatusValue[] = [
	OrderStatus.DRAFT,
	OrderStatus.AWAITING_PAYMENT,
];
