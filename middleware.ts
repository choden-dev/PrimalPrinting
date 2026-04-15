import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Middleware to protect order-related API routes that require authentication.
 *
 * Public routes (no auth required):
 * - GET  /api/timeslots          – list available pickup slots
 * - POST /api/orders/upload      – upload files (auth checked in handler for flexibility)
 * - /api/auth/*                  – NextAuth routes
 * - /api/webhooks/*              – Stripe webhooks
 * - /api/cron/*                  – Cron jobs (protected by CRON_SECRET instead)
 * - /admin/*                     – Payload admin (has its own auth)
 * - All non-API routes           – public pages
 *
 * Protected routes (require NextAuth session):
 * - POST/PATCH /api/orders       – create / update orders
 * - GET /api/orders/my-orders    – user's order history
 * - POST /api/orders/:id/*       – payment, timeslot selection
 */

// Routes that require authentication
const PROTECTED_PATTERNS = [
	/^\/api\/orders$/, // POST/PATCH create/update orders
	/^\/api\/orders\/my-orders$/, // GET user's order list
	/^\/api\/orders\/[^/]+\/create-payment-intent$/, // POST payment intent
	/^\/api\/orders\/[^/]+\/submit-bank-transfer$/, // POST bank transfer proof
	/^\/api\/orders\/[^/]+\/select-timeslot$/, // POST select timeslot
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
	matcher: ["/api/orders/:path*"],
};
