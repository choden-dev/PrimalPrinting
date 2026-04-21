import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Middleware to protect order-related API routes that require authentication.
 *
 * Public routes (no auth required):
 * - GET  /api/pickup-slots           – list available pickup slots
 * - /api/auth/*                      – NextAuth routes
 * - /api/webhooks/*                  – Stripe webhooks
 * - /api/cron/*                      – Cron jobs (protected by CRON_SECRET instead)
 * - /admin/*                         – Payload admin (has its own auth)
 * - All non-API routes               – public pages
 *
 * Protected routes (require NextAuth session):
 * - POST/PATCH /api/shop/orders      – create / finalise orders
 * - POST       /api/shop/staging-urls – issue presigned upload URLs
 * - POST       /api/shop/upload-proof – upload bank transfer proof
 * - GET        /api/shop/my-orders   – user's order history
 * - *          /api/shop/:id/*       – payment, timeslot selection, etc.
 */

// Routes that require authentication. Each handler performs its own
// `getAuthenticatedCustomer` check too — this middleware is defence in depth.
//
// NOTE: `/api/shop/bank-details` is intentionally PUBLIC and must not be
// covered by any pattern below.
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

	if (!token || !token.customerId) {
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
