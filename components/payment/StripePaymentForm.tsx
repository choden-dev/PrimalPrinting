"use client";

import {
	Elements,
	PaymentElement,
	useElements,
	useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useCallback, useEffect, useState } from "react";

// ── Stripe instance (loaded once) ────────────────────────────────────────

let stripePromise: Promise<Stripe | null> | null = null;

function getStripe() {
	if (!stripePromise) {
		stripePromise = loadStripe(
			process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
		);
	}
	return stripePromise;
}

// ── Props ────────────────────────────────────────────────────────────────

interface StripePaymentFormProps {
	/** The order ID to create a payment intent for */
	orderId: string;
	/** Called when payment succeeds */
	onSuccess: (paymentIntentId: string) => void;
	/** Called on payment error */
	onError?: (error: string) => void;
	/** Order total for display (in cents) */
	totalCents: number;
}

// ── Inner form (must be inside Elements provider) ────────────────────────

function PaymentForm({
	onSuccess,
	onError,
	totalCents,
}: Omit<StripePaymentFormProps, "orderId">) {
	const stripe = useStripe();
	const elements = useElements();
	const [loading, setLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const handleSubmit = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault();
			if (!stripe || !elements) return;

			setLoading(true);
			setErrorMessage(null);

			const { error, paymentIntent } = await stripe.confirmPayment({
				elements,
				confirmParams: {
					return_url: `${window.location.origin}/order_complete`,
				},
				redirect: "if_required",
			});

			if (error) {
				const msg = error.message || "Payment failed. Please try again.";
				setErrorMessage(msg);
				onError?.(msg);
				setLoading(false);
			} else if (paymentIntent?.status === "succeeded") {
				onSuccess(paymentIntent.id);
			} else {
				setLoading(false);
			}
		},
		[stripe, elements, onSuccess, onError],
	);

	return (
		<form onSubmit={handleSubmit}>
			<div style={{ marginBottom: "16px" }}>
				<PaymentElement />
			</div>

			{errorMessage && (
				<p
					style={{
						color: "#d32f2f",
						fontSize: "14px",
						marginBottom: "12px",
					}}
				>
					{errorMessage}
				</p>
			)}

			<button
				type="submit"
				disabled={!stripe || loading}
				style={{
					width: "100%",
					padding: "14px",
					background: loading ? "#ccc" : "#1a1a2e",
					color: "#fff",
					border: "none",
					borderRadius: "8px",
					fontSize: "16px",
					fontWeight: 600,
					cursor: loading ? "not-allowed" : "pointer",
				}}
			>
				{loading ? "Processing…" : `Pay $${(totalCents / 100).toFixed(2)}`}
			</button>
		</form>
	);
}

// ── Exported component ───────────────────────────────────────────────────

/**
 * In-app Stripe payment form using Stripe Elements.
 *
 * Fetches a PaymentIntent client secret from the API, then renders a
 * card input form inline — no redirect to Stripe Checkout.
 *
 * ```tsx
 * <StripePaymentForm
 *   orderId={order.id}
 *   totalCents={order.pricing.total}
 *   onSuccess={(id) => router.push(`/order_complete?orderId=${order.id}`)}
 * />
 * ```
 */
export function StripePaymentForm({
	orderId,
	onSuccess,
	onError,
	totalCents,
}: StripePaymentFormProps) {
	const [clientSecret, setClientSecret] = useState<string | null>(null);
	const [fetchError, setFetchError] = useState<string | null>(null);

	useEffect(() => {
		async function createIntent() {
			try {
				const res = await fetch(`/api/shop/${orderId}/create-payment-intent`, {
					method: "POST",
				});
				const data = await res.json();

				if (!res.ok) {
					throw new Error(data.error || "Failed to create payment intent.");
				}

				setClientSecret(data.clientSecret);
			} catch (err) {
				const msg =
					err instanceof Error ? err.message : "Failed to initialise payment.";
				setFetchError(msg);
				onError?.(msg);
			}
		}

		createIntent();
	}, [orderId, onError]);

	if (fetchError) {
		return (
			<div
				style={{
					padding: "16px",
					background: "#ffebee",
					borderRadius: "8px",
					color: "#c62828",
				}}
			>
				{fetchError}
			</div>
		);
	}

	if (!clientSecret) {
		return (
			<div style={{ textAlign: "center", padding: "24px", color: "#666" }}>
				Preparing payment…
			</div>
		);
	}

	return (
		<Elements
			stripe={getStripe()}
			options={{
				clientSecret,
				appearance: {
					theme: "stripe",
					variables: {
						colorPrimary: "#1a1a2e",
						borderRadius: "8px",
					},
				},
			}}
		>
			<PaymentForm
				onSuccess={onSuccess}
				onError={onError}
				totalCents={totalCents}
			/>
		</Elements>
	);
}

export default StripePaymentForm;
