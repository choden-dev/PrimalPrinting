import type { CollectionConfig } from "payload";

/**
 * Customers collection – stores user accounts created via NextAuth Google OAuth.
 *
 * This is intentionally separate from the `users` collection (which is for
 * Payload admin authentication).  NextAuth manages sign-in; this collection
 * persists the resulting profile so orders can be linked to a verified identity.
 *
 * `auth` is NOT enabled here – authentication is handled entirely by NextAuth.
 */
export const Customers: CollectionConfig = {
	slug: "customers",
	admin: {
		useAsTitle: "email",
		defaultColumns: ["email", "name", "createdAt"],
		description:
			"Customer accounts created via Google OAuth sign-in. Managed by NextAuth – do not create manually.",
	},
	access: {
		// Only admins can read/update/delete via the Payload admin panel.
		// All public access goes through NextAuth + custom API routes.
		read: ({ req }) => {
			if (req.user) return true;
			return false;
		},
		create: ({ req }) => {
			// Allow server-side creation (NextAuth adapter) – block admin UI creation
			if (req.user) return true;
			return false;
		},
		update: ({ req }) => {
			if (req.user) return true;
			return false;
		},
		delete: ({ req }) => {
			if (req.user) return true;
			return false;
		},
	},
	fields: [
		{
			name: "email",
			type: "email",
			required: true,
			unique: true,
			index: true,
			admin: {
				description: "Google account email address.",
			},
		},
		{
			name: "name",
			type: "text",
			admin: {
				description: "Display name from the Google profile.",
			},
		},
		{
			name: "googleId",
			type: "text",
			required: true,
			unique: true,
			index: true,
			admin: {
				description:
					"Google account ID (sub claim). Used to match NextAuth sessions.",
			},
		},
		{
			name: "image",
			type: "text",
			admin: {
				description: "Profile picture URL from Google.",
			},
		},
	],
	timestamps: true,
};
