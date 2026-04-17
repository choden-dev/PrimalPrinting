import path from "node:path";
import { fileURLToPath } from "node:url";
import { mongooseAdapter } from "@payloadcms/db-mongodb";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { s3Storage } from "@payloadcms/storage-s3";
import { buildConfig } from "payload";
// sharp removed — native C++ addon incompatible with Cloudflare Workers.
// Images are stored at original size in R2 and served via presigned URLs.
import { AboutSections } from "./collections/AboutSections";
import { Customers } from "./collections/Customers";
import { Media } from "./collections/Media";
import { Orders } from "./collections/Orders";
import { Timeslots } from "./collections/Timeslots";
import { Users } from "./collections/Users";
import { BankDetails } from "./globals/BankDetails";
import { ContactInfo } from "./globals/ContactInfo";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

// Wrap in an async IIFE so that process.env is read at resolution time, not at
// module-load time. On Cloudflare Workers, env vars (secrets set via the
// dashboard) are only injected into process.env when the first request arrives.
// A bare `buildConfig({ url: process.env.DATABASE_URI })` would capture an empty
// string because the module is evaluated before any request triggers env setup.
export default (async () =>
	buildConfig({
		secret: process.env.PAYLOAD_SECRET || "CHANGE-ME-IN-PRODUCTION",
		db: mongooseAdapter({
			url: process.env.DATABASE_URI || "",
			connectOptions: {
				// Prevent indefinite hangs on Cloudflare Workers (stateless runtime).
				// Without these, a slow or unreachable MongoDB will cause the Worker
				// to hang until Cloudflare cancels the request.
				serverSelectionTimeoutMS: 5000,
				connectTimeoutMS: 5000,
				socketTimeoutMS: 10000,
			},
		}),
		editor: lexicalEditor(),
		collections: [Users, Customers, Orders, Timeslots, AboutSections, Media],
		globals: [ContactInfo, BankDetails],
		plugins: [
			...(process.env.R2_S3_ENDPOINT
				? [
						s3Storage({
							collections: {
								media: {
									prefix: "media",
								},
							},
							bucket: process.env.R2_BUCKET || "primalprinting-media",
							config: {
								endpoint: process.env.R2_S3_ENDPOINT,
								credentials: {
									accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
									secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
								},
								region: "auto",
								forcePathStyle: true,
							},
						}),
					]
				: []),
		],
		typescript: {
			outputFile: path.resolve(dirname, "payload-types.ts"),
		},
		admin: {
			user: Users.slug,
			meta: {
				titleSuffix: "- Primal Printing Admin",
			},
			importMap: {
				baseDir: path.resolve(dirname),
			},
			components: {
				views: {
					ordersByTimeslot: {
						Component: "@/components/admin/OrdersByTimeslotView",
						path: "/orders-by-timeslot",
						meta: {
							title: "Orders by Timeslot",
						},
					},
					pendingVerification: {
						Component: "@/components/admin/PendingVerificationView",
						path: "/verify-payments",
						meta: {
							title: "Verify Bank Transfers",
						},
					},
				},
				afterNavLinks: ["@/components/admin/AdminNavLinks"],
			},
		},
	}))();
