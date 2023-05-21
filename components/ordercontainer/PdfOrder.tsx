import { useState, useEffect, useRef } from "react";
import * as pdfjs from "pdfjs-dist";
import { Box, FormControl, Input, Text } from "@chakra-ui/react";
import UploadCard from "../uploadcard/UploadCard";
import { AddIcon } from "@chakra-ui/icons";
import { UploadedPdf } from "../../types/types";
// solution from https://github.com/wojtekmaj/react-pdf/issues/321
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

type Props = {
    uploadedPdfs: UploadedPdf;
    setUploadedPdfs: (T: any[]) => any;
};
const PdfOrder = ({ uploadedPdfs, setUploadedPdfs }: Props) => {
    useEffect(() => {
        const uploadZoneRef = uploadZone.current as HTMLDivElement | null; // Specify type using type assertion
        uploadZoneRef!.addEventListener("dragover", handleDragOver);
        uploadZoneRef!.addEventListener("drop", handleDrop);

        return () => {
            if (uploadZoneRef) {
                uploadZoneRef.removeEventListener("dragover", handleDragOver);
                uploadZoneRef.removeEventListener("drop", handleDrop);
            }
        };
    }, []);
    const uploadZone = useRef(null);
    const defaultUploadZone = useRef(null);
    const formRef = useRef(null);
    const removeFromCart = (name: string): any => {
        const newUploads = uploadedPdfs.filter((pdf) => pdf.name !== name);
        setUploadedPdfs(newUploads);
    };
    const handleColorChange = async (option: boolean, name: string) => {
        const idx = uploadedPdfs.findIndex((pdf) => pdf.name === name);
        let temp = [...uploadedPdfs];
        const toChange = temp[idx];
        console.log(option);
        fetch(`/api/shop?pages=${toChange.pageCount}&isColor=${option}`).then(
            (res) =>
                res.json().then((data) => {
                    console.log(data);
                    temp[idx] = {
                        name: toChange.name,
                        pageCount: toChange.pageCount,
                        price: data.price / 100,
                        priceId: data.priceId,
                        quantity: 1,
                        isColor: option,
                        file: toChange.file,
                    };
                    setUploadedPdfs(temp);
                })
        );
    };
    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();

        let { files } = e.dataTransfer;

        if (files && files.length) {
            const temp = {
                target: {
                    files: files,
                },
            };
            handleFileEvent(temp);
        }
    };
    const handlePdfUpload = (files: File[]) => {
        const uploaded = [...uploadedPdfs];
        files.some((file: File) => {
            //file doesn't exist
            if (uploaded.findIndex((f) => f.name === file.name) === -1) {
                const src = URL.createObjectURL(file);
                let pages: number = -1;
                pdfjs
                    .getDocument(src)
                    .promise.then((doc) => {
                        pages = doc.numPages;
                        fetch(`/api/shop?pages=${pages}&isColor=false`).then(
                            (res) =>
                                res.json().then((data) => {
                                    if (isNaN(data.price)) {
                                        window.alert(
                                            "Pdf is over 400 pages, please email us the pdf and we can arrange something."
                                        );
                                        return;
                                    }
                                    uploaded.push({
                                        name: file.name,
                                        pageCount: pages,
                                        price: data.price / 100,
                                        priceId: data.priceId,
                                        quantity: 1,
                                        isColor: false,
                                        file: file,
                                    });
                                    setUploadedPdfs(uploaded);
                                    console.log(uploaded);
                                })
                        ); // missing closing parenthesis here
                    })
                    .catch(() => console.error("invalid file type"));
            }
        });
    };

    const handleFileEvent = (e) => {
        console.log(e.target.files);
        const files = Array.prototype.slice.call(e.target.files);
        handlePdfUpload(files);
    };
    return (
        <form ref={formRef}>
            <FormControl>
                <Input
                    ref={defaultUploadZone}
                    display="none"
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileEvent}
                />
                <Box
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
                            <Box zIndex="77" key={pdf.name} marginBottom="1rem">
                                <UploadCard
                                    name={pdf.name}
                                    pages={pdf.pageCount}
                                    price={pdf.price}
                                    removeFunction={removeFromCart}
                                    changeFunction={handleColorChange}
                                />
                            </Box>
                        );
                    })}
                    <Text
                        onClick={(e) => {
                            defaultUploadZone.current.click();
                        }}
                        textAlign="center"
                    >
                        Double click to upload *.pdf file to upload (20mb max)
                    </Text>
                    <AddIcon alignSelf="center" />
                </Box>
            </FormControl>
        </form>
    );
};

export default PdfOrder;
