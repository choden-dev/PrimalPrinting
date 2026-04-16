import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getPayloadClient } from "./payload";

/**
 * Shared auth helpers for API routes.
 */

interface AuthenticatedCustomer {
	customerId: string;
	email: string;
	name: string;
}

/**
 * Extract the authenticated customer from a NextAuth JWT in an App Router
 * API route.  Returns `null` if not authenticated.
 */
export async function getAuthenticatedCustomer(
	request: NextRequest,
): Promise<AuthenticatedCustomer | null> {
	const token = await getToken({
		req: request,
		secret: process.env.NEXTAUTH_SECRET,
	});

	if (!token?.customerId) return null;

	return {
		customerId: token.customerId as string,
		email: token.email ?? "",
		name: token.name ?? "",
	};
}

/**
 * Check if the request is from a Payload admin user.
 * Used for admin-only endpoints (approve payment, mark picked up, etc.).
 */
export async function isPayloadAdmin(request: NextRequest): Promise<boolean> {
	try {
		const payload = await getPayloadClient();

		// Extract the Payload JWT from cookies
		const payloadToken = request.cookies.get("payload-token")?.value;
		if (!payloadToken) return false;

		// Verify through Payload's auth
		const { user } = await payload.auth({ headers: request.headers });
		return !!user;
	} catch {
		return false;
	}
}
