import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

/**
 * Helper to create a Lexical rich text state with paragraphs.
 * Each string in the array becomes a paragraph.
 * Supports basic bold via { text: string, bold: true }.
 */
function richText(
	paragraphs: Array<
		string | { text: string; format: "bold" | "italic" | "normal" }[]
	>,
) {
	return {
		root: {
			type: "root",
			children: paragraphs.map((p) => {
				if (typeof p === "string") {
					return {
						type: "paragraph",
						version: 1,
						children: [{ type: "text", version: 1, text: p, format: 0 }],
						direction: "ltr",
						format: "",
						indent: 0,
						textFormat: 0,
						textStyle: "",
					};
				}
				return {
					type: "paragraph",
					version: 1,
					children: p.map((segment) => ({
						type: "text",
						version: 1,
						text: segment.text,
						format: segment.format === "bold" ? 1 : 0,
					})),
					direction: "ltr",
					format: "",
					indent: 0,
					textFormat: 0,
					textStyle: "",
				};
			}),
			direction: "ltr",
			format: "",
			indent: 0,
			version: 1,
		},
	};
}

function richTextImage(src: string) {
	return {
		root: {
			type: "root",
			children: [
				{
					type: "paragraph",
					version: 1,
					children: [
						{
							type: "text",
							version: 1,
							text: src,
							format: 0,
						},
					],
					direction: "ltr",
					format: "",
					indent: 0,
					textFormat: 0,
					textStyle: "",
				},
			],
			direction: "ltr",
			format: "",
			indent: 0,
			version: 1,
		},
	};
}

async function seed() {
	const { getPayload } = await import("payload");
	const config = (await import("./payload.config")).default;

	const payload = await getPayload({ config });

	console.log("🌱 Seeding Payload CMS...\n");

	// Clear existing data
	console.log("Clearing existing data...");
	await payload.delete({ collection: "about-sections", where: {} });

	// Seed about sections
	console.log("Seeding about sections...");

	await payload.create({
		collection: "about-sections",
		data: {
			title: "Cover Image",
			content: richTextImage(
				"https://drive.google.com/thumbnail?id=1Qz_2nuEozFbUypf4jcYApyF2KSkyiTnk&sz=w1000",
			),
		},
	});
	console.log("  ✓ Created Cover Image section");

	await payload.create({
		collection: "about-sections",
		data: {
			title: "About Text",
			content: richText([
				"Ryan is kinda old fashioned when it comes to his studies. He always preferred to have a physical copy of study materials. He swears that paper is better!",
				"We all thought he was crazy until we found that several studies have reported that although reading and writing on a computer saves time because it is a faster process, taking notes by hand and reading from a physical book improves students' memorization, word recognition and conceptual understanding!",
				"However, many students only receive digital files for their study material, and printing options can be expensive or limited.",
				"Primal Printing provides an affordable printing and binding service for students and individuals who want high-quality physical copies of their own documents.",
				"Upload your PDF (lecture notes, readings, study material, or notes) and choose your print preferences! Orders are ready typically in just 1-2 days. We travel to hand out your printing at designated on-campus meeting points",
				[
					{
						text: `Click "order now" to upload your file and get an automatic quote! Or email us your file at ${process.env.CONTACT_EMAIL || "our email"} with your name and colour preference, and we'll get back to you asap :)`,
						format: "bold",
					},
				],
			]),
		},
	});
	console.log("  ✓ Created About Text section");

	// Seed contact info global
	console.log("\nSeeding contact info...");
	const contactEmail = process.env.CONTACT_EMAIL;
	const contactPhone = process.env.CONTACT_PHONE;
	if (!contactEmail || !contactPhone) {
		console.log(
			"  ⚠ Skipping contact info: set CONTACT_EMAIL and CONTACT_PHONE env vars to seed",
		);
	} else {
		await payload.updateGlobal({
			slug: "contact-info",
			data: {
				email: contactEmail,
				phone: contactPhone,
			},
		});
		console.log(`  ✓ Set email: ${contactEmail}`);
		console.log(`  ✓ Set phone: ${contactPhone}`);
	}

	console.log("\n✅ Seeding complete!");
	process.exit(0);
}

seed().catch((err) => {
	console.error("Seeding failed:", err);
	process.exit(1);
});
