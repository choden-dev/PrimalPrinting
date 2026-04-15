import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getPayloadClient } from "../../../../lib/payload";

/**
 * NextAuth configuration for customer authentication.
 *
 * Uses Google OAuth to verify customer identity. On first sign-in a
 * record is upserted into the Payload `customers` collection so every
 * order can be linked to a verified account.
 *
 * Admin users continue to authenticate via the Payload admin panel
 * (separate `users` collection with `auth: true`).
 */
export const authOptions: NextAuthOptions = {
	providers: [
		GoogleProvider({
			clientId: process.env.GOOGLE_CLIENT_ID || "",
			clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
		}),
	],

	session: {
		strategy: "jwt",
		maxAge: 30 * 24 * 60 * 60, // 30 days
	},

	callbacks: {
		/**
		 * On sign-in: upsert the customer in Payload so we have a stable
		 * internal ID to attach orders to.
		 */
		async signIn({ user, account, profile }) {
			if (account?.provider !== "google" || !profile?.email) return false;

			try {
				const payload = await getPayloadClient();

				// Check if customer already exists
				const existing = await payload.find({
					collection: "customers",
					where: { googleId: { equals: account.providerAccountId } },
					limit: 1,
				});

				if (existing.docs.length === 0) {
					// Create new customer record
					await payload.create({
						collection: "customers",
						data: {
							email: profile.email,
							name: user.name || profile.name || "",
							googleId: account.providerAccountId,
							image: user.image || "",
						},
					});
				} else {
					// Update profile info in case it changed
					await payload.update({
						collection: "customers",
						id: existing.docs[0].id,
						data: {
							name: user.name || profile.name || existing.docs[0].name || "",
							image: user.image || existing.docs[0].image || "",
							email: profile.email,
						},
					});
				}

				return true;
			} catch (error) {
				console.error("NextAuth signIn callback error:", error);
				return false;
			}
		},

		/**
		 * Enrich the JWT with the Payload customer ID so API routes can
		 * look up the customer without an extra DB query.
		 */
		async jwt({ token, account }) {
			if (account?.provider === "google" && account.providerAccountId) {
				try {
					const payload = await getPayloadClient();
					const result = await payload.find({
						collection: "customers",
						where: { googleId: { equals: account.providerAccountId } },
						limit: 1,
					});

					if (result.docs.length > 0) {
						token.customerId = result.docs[0].id;
					}
				} catch (error) {
					console.error("NextAuth jwt callback error:", error);
				}
			}
			return token;
		},

		/**
		 * Expose the Payload customer ID on the client-side session object.
		 */
		async session({ session, token }) {
			if (token.customerId) {
				(session as any).customerId = token.customerId;
			}
			return session;
		},
	},

	pages: {
		signIn: "/auth/signin",
		error: "/auth/error",
	},
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
