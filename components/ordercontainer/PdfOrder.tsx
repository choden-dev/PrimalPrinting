import { useState, useEffect, useRef, useContext } from "react";
import * as pdfjs from "pdfjs-dist";
import { Box, FormControl, Heading, Input, Text } from "@chakra-ui/react";
import UploadCard from "../uploadcard/UploadCard";
import { AddIcon } from "@chakra-ui/icons";
import { CartContext } from "../../contexts/CartContext";
import PdfCartItem from "../../types/models/PdfCartItem";
// solution from https://github.com/wojtekmaj/react-pdf/issues/321
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

const DEFAULT_IS_COLOR = false;

const PdfOrder = () => {
  const { uploadedPdfs, addUploadedPdf, removeUploadedPdf, updateUploadedPdf } =
    useContext(CartContext);
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

  const handleColorChange = async (option: boolean, toFind: PdfCartItem) => {
    const idx = uploadedPdfs.findIndex(
      (pdf) => pdf.displayName === toFind.displayName
    );
    let temp = [...uploadedPdfs];
    const toChange = temp[idx];
    console.log(option);
    fetch(`/api/shop?pages=${toChange.getPages()}&isColor=${option}`).then(
      (res) =>
        res.json().then((data) => {
          console.log(data);
          toChange.isColor = option;
          toChange.priceId = data.priceId;
          toChange.setUnitPrice(data.price / 100);
          updateUploadedPdf(toChange);
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
      if (uploaded.findIndex((f) => f.displayName === file.name) === -1) {
        const src = URL.createObjectURL(file);
        let pages: number = -1;
        pdfjs
          .getDocument(src)
          .promise.then((doc) => {
            pages = doc.numPages;
            fetch(`/api/shop?pages=${pages}&isColor=${DEFAULT_IS_COLOR}`).then(
              (res) =>
                res.json().then((data) => {
                  if (isNaN(data.price)) {
                    window.alert(
                      "Pdf is over 400 pages, please email us the pdf and we can arrange something."
                    );
                    return;
                  }
                  const uid = () =>
                    String(
                      Date.now().toString(32) + Math.random().toString(16)
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
                      file
                    )
                  );
                })
            );
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
            onClick={(e) => {
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
