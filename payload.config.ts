import path from "node:path";
import { fileURLToPath } from "node:url";
import { mongooseAdapter } from "@payloadcms/db-mongodb";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { buildConfig } from "payload";
import sharp from "sharp";
import { AboutSections } from "./collections/AboutSections";
import { Media } from "./collections/Media";
import { Users } from "./collections/Users";
import { ContactInfo } from "./globals/ContactInfo";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default buildConfig({
	secret: process.env.PAYLOAD_SECRET || "CHANGE-ME-IN-PRODUCTION",
	db: mongooseAdapter({
		url: process.env.DATABASE_URI || process.env.MONGODB_URI || "",
	}),
	editor: lexicalEditor(),
	collections: [Users, AboutSections, Media],
	globals: [ContactInfo],
	sharp,
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
	},
});
