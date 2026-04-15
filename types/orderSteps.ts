/**
 * Order flow step constants — the user-facing steps of the ordering process.
 *
 * Flow: UPLOAD → PAYMENT → PICKUP → COMPLETE
 */
export const OrderStep = {
	UPLOAD: "upload",
	PAYMENT: "payment",
	PICKUP: "pickup",
	COMPLETE: "complete",
} as const;

export type OrderStepValue = (typeof OrderStep)[keyof typeof OrderStep];
