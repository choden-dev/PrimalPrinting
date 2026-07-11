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
import { PickupInstructionProfiles } from "./collections/PickupInstructionProfiles";
import { Schedules } from "./collections/Schedules";
import { Timeslots } from "./collections/Timeslots";
import { Users } from "./collections/Users";
import { BankDetails } from "./globals/BankDetails";
import { ContactInfo } from "./globals/ContactInfo";
import { ScheduleSettings } from "./globals/ScheduleSettings";

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
				// Keep a warm pool of sockets pinned open. The MongoDB driver
				// defaults to `minPoolSize: 0`, which means every socket the
				// pool opens is torn down once it goes idle — so even though
				// the container is kept warm (see container-worker.js /
				// wrangler cron), a visitor arriving after a quiet gap would
				// still pay a full TLS + SCRAM auth handshake to (re)open a
				// connection. Pinning a minimum pool keeps authenticated
				// sockets alive between the keep-warm pings, so real requests
				// reuse an established connection instead of re-handshaking.
				// `maxIdleTimeMS: 0` (the default) means pooled sockets are
				// never expired for idleness; we set it explicitly for clarity
				// alongside the min pool so the intent survives future edits.
				minPoolSize: 2,
				maxPoolSize: 10,
				maxIdleTimeMS: 0,
				// Disable Mongoose autoIndex in production. By default the mongodb
				// adapter connects with `autoIndex: true`, which makes Mongoose
				// verify/build the indexes for EVERY collection (Users, Customers,
				// Orders, Timeslots, Schedules, …) against MongoDB right after the
				// connection opens. On a cold container start that first request
				// pays the cost of all those index round-trips, producing the very
				// long / timeout-prone loads reported for the first visitor after
				// the container scales back up.
				//
				// Indexes should instead be created once (via `payload migrate` or
				// a one-off admin login), not rebuilt on every cold connect. We
				// keep autoIndex enabled in development so schema/index changes are
				// picked up automatically while iterating locally.
				autoIndex: process.env.NODE_ENV !== "production",
			},
		}),
		editor: lexicalEditor(),
		collections: [
			Users,
			Customers,
			Orders,
			Timeslots,
			Schedules,
			PickupInstructionProfiles,
			AboutSections,
			Media,
		],
		globals: [ContactInfo, BankDetails, ScheduleSettings],
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
					notifyTimeslots: {
						Component: "@/components/admin/NotifyTimeslotsView",
						path: "/notify-timeslots",
						meta: {
							title: "Notify Customers — Timeslots",
						},
					},
					scheduleCalendar: {
						Component: "@/components/admin/ScheduleCalendarView",
						path: "/schedule-calendar",
						meta: {
							title: "Schedule Calendar",
						},
					},
				},
				afterNavLinks: ["@/components/admin/AdminNavLinks"],
			},
		},
	}))();
