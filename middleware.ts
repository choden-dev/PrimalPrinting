import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Middleware to protect order-related API routes that require a NextAuth
 * session. The matcher below only runs this on `/api/shop/*`; each protected
 * pattern is documented inline. Other routes (auth, webhooks, cron, admin,
 * pages) are public here and rely on their own auth.
 */

// Routes that require authentication. Each handler also runs its own
// `getAuthenticatedCustomer` check — this middleware is defence in depth.
// NOTE: `/api/shop/bank-details` is intentionally PUBLIC (not matched below).
const PROTECTED_PATTERNS = [
	/^\/api\/shop\/orders$/, // POST/PATCH create/finalise orders
	/^\/api\/shop\/staging-urls$/, // POST issue presigned upload URLs
	/^\/api\/shop\/upload-proof$/, // POST bank transfer proof image
	/^\/api\/shop\/my-orders$/, // GET user's order list
	/^\/api\/shop\/[^/]+\/create-payment-intent$/, // POST payment intent
	/^\/api\/shop\/[^/]+\/submit-bank-transfer$/, // POST bank transfer proof submission
	/^\/api\/shop\/[^/]+\/select-timeslot$/, // POST select timeslot
	/^\/api\/shop\/[^/]+\/approve-payment$/, // POST approve payment (admin)
	/^\/api\/shop\/[^/]+\/delete$/, // POST delete order
];

export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// Check if the route requires authentication
	const isProtected = PROTECTED_PATTERNS.some((pattern) =>
		pattern.test(pathname),
	);

	if (!isProtected) {
		return NextResponse.next();
	}

	// Verify NextAuth JWT
	const token = await getToken({
		req: request,
		secret: process.env.NEXTAUTH_SECRET,
	});

	if (!token?.customerId) {
		return NextResponse.json(
			{ error: "Authentication required. Please sign in with Google." },
			{ status: 401 },
		);
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/api/shop/:path*"],
};
