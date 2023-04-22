import { useState, useRef, useEffect } from "react";
import {
    Box,
    FormLabel,
    Input,
    Heading,
    FormControl,
    Textarea,
    List,
    ListItem,
    Button,
    useMediaQuery,
    Text,
} from "@chakra-ui/react";
import ProductCard from "../productcard/ProductCard";
import UploadCard from "../uploadcard/UploadCard";
import * as pdfjs from "pdfjs-dist";
import Footer from "../footer/Footer";
import { AddIcon } from "@chakra-ui/icons";
import { createSession } from "../../lib/stripe";
import ItemModal from "../itemmodal/ItemModal";
// solution from https://github.com/wojtekmaj/react-pdf/issues/321
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

const OrderContainer = () => {
    const [modalOpen, setModalOpen] = useState(false);
    const [packages, setPackages] = useState(undefined);
    const [cartPackages, setCartPackages] = useState([]);
    const [uploadedPdfs, setUploadedPdfs] = useState<
        {
            name: string;
            pageCount: number;
            price: number;
            priceId: string;
            quantity: number;
            isColor: boolean;
        }[]
    >([]);
    const [smallScreen] = useMediaQuery(`(max-width: 1000px)`);
    const uploadZone = useRef(null);
    const defaultUploadZone = useRef(null);

    useEffect(() => {
        fetch(`/api/products`).then((res) =>
            res.json().then((data) => {
                console.log(data.packages.data);
                setPackages(data.packages.data);
            })
        );
    }, []);

    useEffect(() => {
        uploadZone.current.addEventListener("dragover", handleDragOver);
        uploadZone.current.addEventListener("drop", handleDrop);

        return () => {
            if (uploadZone.current) {
                uploadZone.current.removeEventListener(
                    "dragover",
                    handleDragOver
                );
                uploadZone.current.removeEventListener("drop", handleDrop);
            }
        };
    }, []);
    const closeModal = () => {
        setModalOpen(false);
    };
    const startOrder = () => {
        const items: { price: string; quantity: number }[] = [];
        uploadedPdfs.map((pdf) => {
            items.push({ price: pdf.priceId, quantity: pdf.quantity });
        });
        cartPackages.map((cartPackage) => {
            items.push({ price: cartPackage.priceId, quantity: 1 });
        });
        if (items.length === 0) return;
        const arrStr = encodeURIComponent(JSON.stringify(items));

        fetch(`/api/checkout?items=${arrStr}`).then((res) => {
            res.json().then((data) => {
                window.location.replace(data.paymentLink);
            });
        });
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
                    };
                    setUploadedPdfs(temp);
                })
        );
    };
    const addPackage = (
        id: string,
        name: string,
        priceId: string,
        price: number
    ) => {
        const temp = [...cartPackages];
        if (temp.find((item) => item.id === id)) return;
        temp.push({ id: id, name: name, priceId: priceId, price: price });
        console.log(temp);
        setCartPackages(temp);
    };
    const removePackage = (id: string) => {
        const newPackages = cartPackages.filter((item) => item.id !== id);
        setCartPackages(newPackages);
    };
    const removeFromCart = (name: string): any => {
        const newUploads = uploadedPdfs.filter((pdf) => pdf.name !== name);
        setUploadedPdfs(newUploads);
    };
    const changeQuantity = (name: string, newQuantity: number): any => {
        const idx = uploadedPdfs.findIndex((pdf) => pdf.name === name);
        let temp = [...uploadedPdfs];
        temp[idx].quantity = newQuantity;
        setUploadedPdfs(temp);
    };

    const calculateTotalPrice = () => {
        let sum = 0;
        uploadedPdfs.map((pdf) => {
            sum += pdf.price;
        });
        cartPackages.map((cartPackage) => {
            sum += cartPackage.price;
        });
        return sum.toFixed(2);
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
                                    uploaded.push({
                                        name: file.name,
                                        pageCount: pages,
                                        price: data.price / 100,
                                        priceId: data.priceId,
                                        quantity: 1,
                                        isColor: false,
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
        <>
            <ItemModal isOpen={modalOpen} closeFunction={closeModal} />
            <Box
                paddingTop="1rem"
                display="grid"
                columnGap="1rem"
                rowGap="1rem"
                gridTemplateColumns={smallScreen ? "1fr" : "3fr 1.5fr"}
            >
                <Box
                    bg="white"
                    padding="1rem"
                    position="relative"
                    overflowX="visible"
                >
                    <Box
                        position="absolute"
                        top="0"
                        left="-2rem"
                        h="100%"
                        w="2.8rem"
                        overflowY="hidden"
                        backgroundImage="/binder.png"
                    ></Box>
                    <Box display="flex" flexDir="column" gap="1rem">
                        <Box
                            display="grid"
                            gridTemplateColumns={
                                smallScreen ? "1fr" : "1fr 1fr"
                            }
                        >
                            {packages &&
                                packages.map((item) => {
                                    return (
                                        <ProductCard
                                            key={item.updated}
                                            addFunction={addPackage}
                                            orderPackage={{
                                                title: item.name,
                                                id: item.id,
                                                priceId: item.default_price,
                                                description: item.description,
                                                price: item.price / 100,
                                            }}
                                            image=""
                                            hasButton={true}
                                        />
                                    );
                                })}
                        </Box>
                        <FormControl>
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
                                <Input
                                    ref={defaultUploadZone}
                                    display="none"
                                    type="file"
                                    accept="application/pdf"
                                    onChange={handleFileEvent}
                                />
                                {uploadedPdfs.map((pdf) => {
                                    return (
                                        <Box
                                            zIndex="77"
                                            key={pdf.name}
                                            marginBottom="1rem"
                                        >
                                            <UploadCard
                                                name={pdf.name}
                                                pages={pdf.pageCount}
                                                price={pdf.price}
                                                removeFunction={removeFromCart}
                                                changeFunction={
                                                    handleColorChange
                                                }
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
                                    Click or drag *.pdf file to upload
                                </Text>
                                <AddIcon alignSelf="center" />
                            </Box>
                            <Box display="flex" flexDir="column" gap="1rem">
                                <Box
                                    display="grid"
                                    gridTemplateColumns="1fr 1fr"
                                    columnGap="1rem"
                                >
                                    <FormLabel>Name</FormLabel>
                                    <FormLabel>Email</FormLabel>
                                    <Input type="text" borderRadius="sm" />
                                    <Input type="email" borderRadius="sm" />
                                </Box>
                                <FormLabel>Extra requests</FormLabel>
                                <Textarea borderRadius="sm" />
                            </Box>
                        </FormControl>
                    </Box>
                </Box>
                <Box
                    w="100%"
                    bg="white"
                    h="fit-content"
                    position={smallScreen ? "relative" : "sticky"}
                    padding="1rem .5rem"
                    top={smallScreen ? "0" : "5rem"}
                >
                    <Box display="flex" flexDir="column">
                        <Heading fontSize="1.5rem" as="p">
                            Total Price
                        </Heading>
                        <List>
                            {cartPackages.map((cartPackage) => {
                                return (
                                    <ListItem key={cartPackage.id}>
                                        <Box display="flex">
                                            <Text>{cartPackage.name}</Text>
                                            <Text
                                                marginLeft="auto"
                                                fontWeight="800"
                                                cursor="pointer"
                                                onClick={() =>
                                                    removePackage(
                                                        cartPackage.id
                                                    )
                                                }
                                            >
                                                X
                                            </Text>
                                        </Box>
                                    </ListItem>
                                );
                            })}
                            {uploadedPdfs && (
                                <>
                                    <Heading as="span" fontSize="1rem">
                                        Uploaded Files
                                    </Heading>
                                    {uploadedPdfs.map((pdf) => {
                                        return (
                                            <ListItem key={pdf.name}>
                                                <Box display="flex">
                                                    <Text>
                                                        {pdf.name} |{" "}
                                                        {pdf.price *
                                                            pdf.quantity}
                                                    </Text>
                                                    <Input
                                                        min="1"
                                                        max="5"
                                                        marginLeft="auto"
                                                        borderRadius="sm"
                                                        type="number"
                                                        placeholder={
                                                            pdf.quantity
                                                        }
                                                        onChange={(e) => {
                                                            const num =
                                                                parseInt(
                                                                    e.target
                                                                        .value
                                                                );
                                                            const min =
                                                                parseInt(
                                                                    e.target.min
                                                                );
                                                            const max =
                                                                parseInt(
                                                                    e.target.max
                                                                );
                                                            if (
                                                                num > max ||
                                                                num < min
                                                            ) {
                                                                e.target.value =
                                                                    pdf.quantity;
                                                                return;
                                                            }
                                                            changeQuantity(
                                                                pdf.name,
                                                                parseInt(
                                                                    e.target
                                                                        .value
                                                                )
                                                            );
                                                        }}
                                                    />
                                                </Box>
                                            </ListItem>
                                        );
                                    })}
                                </>
                            )}
                            <ListItem>
                                <strong>
                                    Estimated Price: {calculateTotalPrice()}
                                </strong>
                            </ListItem>
                            <Button
                                variant="browned"
                                onClick={() => {
                                    setModalOpen(true);
                                }}
                            >
                                Order Now
                            </Button>
                        </List>
                    </Box>
                </Box>
            </Box>
            <Footer />
        </>
    );
};
export default OrderContainer;
