import { AddIcon } from "@chakra-ui/icons";
import { Box, FormControl, Heading, Input, Text } from "@chakra-ui/react";
import type * as pdfjsTypes from "pdfjs-dist";
import type React from "react";
import { useCallback, useContext, useEffect, useRef } from "react";
import { CartContext } from "../../contexts/CartContext";
import PdfCartItem from "../../types/models/PdfCartItem";
import UploadCard from "../uploadcard/UploadCard";

const DEFAULT_IS_COLOR = false;

/**
 * Lazily load pdfjs-dist on the client only.
 * pdfjs-dist relies on browser APIs and cannot run on Cloudflare Workers
 * during SSR — importing it at module scope causes a TypeError.
 */
let pdfjsPromise: Promise<typeof pdfjsTypes> | null = null;
function getPdfjs(): Promise<typeof pdfjsTypes> {
	if (!pdfjsPromise) {
		pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
			// Bundle the worker locally (via new URL + import.meta.url) instead
			// of a third-party CDN, which avoids CDN/version/CSP failures.
			pdfjs.GlobalWorkerOptions.workerSrc = new URL(
				"pdfjs-dist/build/pdf.worker.min.mjs",
				import.meta.url,
			).toString();
			return pdfjs;
		});
	}
	return pdfjsPromise;
}

const PdfOrder = () => {
	const { uploadedPdfs, addUploadedPdf, removeUploadedPdf, updateUploadedPdf } =
		useContext(CartContext);
	const uploadZone = useRef(null);
	const defaultUploadZone = useRef<HTMLInputElement>(null);

	// Eagerly start loading pdfjs when component mounts (client-side only)
	useEffect(() => {
		getPdfjs();
	}, []);

	const handleColorChange = async (option: boolean, toFind: PdfCartItem) => {
		const idx = uploadedPdfs.findIndex(
			(pdf) => pdf.displayName === toFind.displayName,
		);
		const temp = [...uploadedPdfs];
		const toChange = temp[idx];
		console.log(option);
		fetch(`/api/shop?pages=${toChange.getPages()}&isColor=${option}`)
			.then((res) =>
				res.json().then((data) => {
					console.log(data);
					if (!data.success || data.priceId == null || data.price == null) {
						window.alert(
							"We couldn't work out a price for this file right now. Please try again, or contact us if the problem persists.",
						);
						return;
					}
					toChange.isColor = option;
					toChange.priceId = data.priceId;
					toChange.setUnitPrice(data.price / 100);
					updateUploadedPdf(toChange);
				}),
			)
			.catch((err) => {
				// A rejected request or a non-JSON error response must not leave
				// the item in an inconsistent state or surface as an unhandled
				// rejection — surface a clear message instead.
				console.error("Failed to reprice file on colour change:", err);
				window.alert(
					"We couldn't work out a price for this file right now. Please try again, or contact us if the problem persists.",
				);
			});
	};
	const _handleDragOver = useCallback(
		(e: { preventDefault: () => void; stopPropagation: () => void }) => {
			e.preventDefault();
			e.stopPropagation();
		},
		[],
	);

	const handlePdfUpload = useCallback(
		(files: File[]) => {
			const uploaded = [...uploadedPdfs];
			files.forEach((file: File) => {
				// Skip files that are already in the cart
				if (uploaded.findIndex((f) => f.displayName === file.name) === -1) {
					const src = URL.createObjectURL(file);
					let pages: number = -1;
					getPdfjs()
						.then((pdfjs) => pdfjs.getDocument(src).promise)
						.then((doc) => {
							pages = doc.numPages;
							// Return the fetch promise so a rejected request or a
							// non-JSON error response propagates to the outer
							// .catch() below instead of becoming an unhandled
							// rejection during the initial upload.
							return fetch(
								`/api/shop?pages=${pages}&isColor=${DEFAULT_IS_COLOR}`,
							).then((res) =>
								res.json().then((data) => {
									if (
										!data.success ||
										data.price == null ||
										data.priceId == null
									) {
										window.alert(
											"We couldn't work out a price for this file right now. Please try again, or contact us if the problem persists.",
										);
										return;
									}
									if (Number.isNaN(data.price)) {
										window.alert(
											"Pdf is over 400 pages, please email us the pdf and we can arrange something.",
										);
										return;
									}
									const uid = () =>
										String(
											Date.now().toString(32) + Math.random().toString(16),
										).replace(/\./g, "");

									addUploadedPdf(
										new PdfCartItem(
											uid(),
											file.name,
											1,
											data.price / 100,
											data.priceId,
											pages,
											DEFAULT_IS_COLOR,
											file,
											data.productId,
										),
									);
								}),
							);
						})
						.catch((err) => {
							// Log the underlying pdfjs error so genuine load/parse
							// failures remain debuggable.
							console.error("PDF processing failed:", err);
							const name = err instanceof Error ? err.name : "UnknownError";
							const isInvalidPdf =
								name === "InvalidPDFException" ||
								name === "PasswordException" ||
								name === "MissingPDFException";
							if (isInvalidPdf) {
								window.alert(
									"This file doesn't appear to be a valid PDF. Please try a different file.",
								);
							} else {
								window.alert(
									"Something went wrong processing this PDF. Please try again, or contact us if the problem persists.",
								);
							}
						});
				}
			});
		},
		[addUploadedPdf, uploadedPdfs],
	);

	const handleFileEvent = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			console.log(e.target.files);
			const files = Array.from(e.target.files || []);
			handlePdfUpload(files);
		},
		[handlePdfUpload],
	);

	const handleDrop = useCallback(
		(e: DragEvent) => {
			e.preventDefault();
			e.stopPropagation();

			const { files } = e.dataTransfer || {};

			if (files?.length) {
				const temp = {
					target: {
						files: files,
					},
				} as React.ChangeEvent<HTMLInputElement>;
				handleFileEvent(temp);
			}
		},
		[handleFileEvent],
	);

	useEffect(() => {
		const uploadZoneRef = uploadZone.current as HTMLDivElement | null;

		const handleDragOver = (e: DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
		};

		uploadZoneRef?.addEventListener("dragover", handleDragOver);
		uploadZoneRef?.addEventListener("drop", handleDrop);

		return () => {
			if (uploadZoneRef) {
				uploadZoneRef.removeEventListener("dragover", handleDragOver);
				uploadZoneRef.removeEventListener("drop", handleDrop);
			}
		};
	}, [handleDrop]);

	return (
		<>
			<Heading textAlign="center" marginBottom="1rem">
				Upload a Pdf
			</Heading>
			<form>
				<FormControl>
					<Input
						ref={defaultUploadZone}
						display="none"
						height="100%"
						type="file"
						accept="application/pdf"
						onChange={handleFileEvent}
					/>
					<Box
						onClick={(_e) => {
							defaultUploadZone.current?.click();
						}}
						zIndex="76"
						display="flex"
						flexDir="column"
						cursor="pointer"
						minH="5rem"
						padding="0.5rem"
						w="100%"
						bg="brown.100"
						borderRadius="2px"
						ref={uploadZone}
					>
						{uploadedPdfs.map((pdf) => {
							return (
								<Box key={pdf.id} zIndex="77" marginBottom="1rem">
									<UploadCard
										uploadedItem={pdf}
										removeFunction={removeUploadedPdf}
										changeFunction={handleColorChange}
									/>
								</Box>
							);
						})}
						<Text textAlign="center">
							Double click to upload *.pdf file to upload (20mb max)
						</Text>
						<AddIcon alignSelf="center" />
					</Box>
				</FormControl>
			</form>
		</>
	);
};

export default PdfOrder;
