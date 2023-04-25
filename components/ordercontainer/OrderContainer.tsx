import { useRouter } from "next/router";
import { useState, useRef, useEffect } from "react";
import {
    Box,
    FormLabel,
    Input,
    Divider,
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
import ProcessingOverlay from "../processingoverlay/ProcessingOverlay";
import * as pdfjs from "pdfjs-dist";
import Footer from "../footer/Footer";
import { AddIcon } from "@chakra-ui/icons";
import { OrderRow } from "../../types/types";
import ItemModal from "../itemmodal/ItemModal";
// solution from https://github.com/wojtekmaj/react-pdf/issues/321
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;
type Props = {
    packages: any;
};
const OrderContainer = ({ packages }: Props) => {
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [cartPackages, setCartPackages] = useState([]);
    const [uploadedPdfs, setUploadedPdfs] = useState<
        {
            name: string;
            pageCount: number;
            price: number;
            priceId: string;
            quantity: number;
            isColor: boolean;
            file: File;
        }[]
    >([]);
    const [smallScreen] = useMediaQuery(`(max-width: 1000px)`);
    const router = useRouter();
    const uploadZone = useRef(null);
    const defaultUploadZone = useRef(null);
    const formRef = useRef(null);

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
    const closeModal = () => {
        setModalOpen(false);
    };

    const collateOrder = (
        urls: { name: string; url: string }[],
        isBankTransfer: boolean
    ) => {
        const orders: OrderRow[] = [];
        const form = formRef.current;
        const name = form!.name.value;
        const email = form!.email.value;
        const message = form!.message.value;
        const paymentMethod = isBankTransfer ? "Bank" : "Credit Card";
        uploadedPdfs.map((pdf) => {
            const idx = urls.findIndex((item) => item.name === pdf.name);
            const order: OrderRow = {
                name: name,
                email: email,
                message: message,
                pages: pdf.pageCount,
                coursebookName: pdf.name,
                quantity: pdf.quantity,
                cost: pdf.price,
                colour: pdf.isColor,
                coursebookLink: urls[idx].url,
                paid: false,
                paymentMethod: paymentMethod,
            };
            orders.push(order);
        });
        cartPackages.map((cartPackage) => {
            const order: OrderRow = {
                name: name,
                email: email,
                message: message,
                quantity: 1,
                coursebookLink: cartPackage.name,
                cost: cartPackage.price,
                colour: false,
                paid: false,
                paymentMethod: paymentMethod,
            };
            orders.push(order);
        });
        fetch(`api/createorder`, {
            method: "POST",
            body: JSON.stringify(orders),
        }).then((res) =>
            res.json().then((data) => {
                if (isBankTransfer) {
                    setIsProcessing(false);
                    router.push(
                        `/order_complete?orderId=${
                            data.message.orderId
                        }&items=${JSON.stringify(data.message.coursebooks)}`
                    );
                } else {
                    setIsProcessing(false);
                    payWithCreditCard(data.message.orderId);
                }
            })
        );
    };

    const checkFormValidity = () => {
        const form = formRef.current;
        console.log(form.name.value);
        return (
            form.checkValidity() &&
            ((cartPackages && cartPackages.length !== 0) ||
                (uploadedPdfs && uploadedPdfs.length !== 0))
        );
    };
    const handleOrderInformation = (isBankTransfer: boolean) => {
        //heavily adapted from https://github.com/jozzer182/YoutubeCodes/blob/main/UploadFromWeb
        setModalOpen(false);
        setIsProcessing(true);
        const promises = [];
        for (let i = 0; i < uploadedPdfs.length; ++i) {
            const file = uploadedPdfs[i].file;
            const reader = new FileReader();
            const promise = new Promise((resolve, reject) => {
                reader.onload = function (e) {
                    var rawLog = reader.result.split(",")[1];
                    var dataSend = {
                        dataReq: {
                            data: rawLog,
                            name: file.name,
                            type: file.type,
                        },
                        fname: "uploadFilesToGoogleDrive",
                    };
                    console.log(dataSend);
                    fetch(`/api/upload`, {
                        method: "POST",
                        body: JSON.stringify(dataSend),
                    })
                        .then((res) => res.json())
                        .then((data) => {
                            resolve(data);
                        })
                        .catch((e) => {
                            reject(e);
                        });
                };
                reader.readAsDataURL(file);
            });
            promises.push(promise);
        }
        const temp = [];
        Promise.all(promises)
            .then((res) =>
                res.map((item) => {
                    const info = item.message;
                    temp.push({ name: info.name, url: info.url });
                })
            )
            .then(() => {
                collateOrder(temp, isBankTransfer);
            });
    };
    const payWithCreditCard = (orderId: string) => {
        const items: { price: string; quantity: number }[] = [];
        uploadedPdfs.map((pdf) => {
            items.push({ price: pdf.priceId, quantity: pdf.quantity });
        });
        cartPackages.map((cartPackage) => {
            items.push({ price: cartPackage.priceId, quantity: 1 });
        });
        if (items.length === 0) return;
        const toPost = {
            items: items,
            orderId: orderId,
            email: formRef.current.email.value,
        };

        fetch(`/api/checkout`, {
            method: "POST",
            body: JSON.stringify(toPost),
        }).then((res) => {
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
                        file: toChange.file,
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
        <>
            <ProcessingOverlay show={isProcessing} />
            <ItemModal
                isOpen={modalOpen}
                closeFunction={closeModal}
                creditCard={() => handleOrderInformation(false)}
                bankTransfer={() => handleOrderInformation(true)}
            />

            <Box
                paddingTop="1rem"
                display="grid"
                columnGap="1rem"
                rowGap="1rem"
                gridTemplateColumns={smallScreen ? "1fr" : "3fr 1.5fr"}
            >
                <Box
                    border="1px"
                    borderColor="brown.200"
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
                                            <Box
                                                zIndex="77"
                                                key={pdf.name}
                                                marginBottom="1rem"
                                            >
                                                <UploadCard
                                                    name={pdf.name}
                                                    pages={pdf.pageCount}
                                                    price={pdf.price}
                                                    removeFunction={
                                                        removeFromCart
                                                    }
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
                                        Click or drag *.pdf file to upload (20mb
                                        max)
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
                                        <Input
                                            isRequired
                                            name="name"
                                            minLength={2}
                                            type="text"
                                            borderRadius="sm"
                                        />
                                        <Input
                                            name="email"
                                            type="email"
                                            borderRadius="sm"
                                        />
                                    </Box>
                                    <FormLabel>Extra requests</FormLabel>
                                    <Textarea
                                        name="message"
                                        type="text"
                                        borderRadius="sm"
                                    />
                                </Box>
                            </FormControl>
                        </form>
                    </Box>
                </Box>
                <Box
                    w="100%"
                    bg="white"
                    h="fit-content"
                    position={smallScreen ? "relative" : "sticky"}
                    padding="1rem .5rem"
                    border="1px"
                    color="brown.900"
                    borderColor="brown.200"
                    top={smallScreen ? "0" : "5rem"}
                >
                    <Box display="flex" flexDir="column">
                        <Heading fontSize="1.5rem" as="p">
                            Total Price
                        </Heading>
                        <List>
                            <Text fontWeight="800">Packages</Text>
                            <Divider marginBottom=".5rem" />
                            {cartPackages.map((cartPackage) => {
                                return (
                                    <ListItem key={cartPackage.id}>
                                        <Box
                                            display="flex"
                                            border="1px solid"
                                            borderColor="brown.700"
                                            padding="1rem"
                                            borderRadius="sm"
                                            marginBottom=".5rem"
                                        >
                                            <Text>
                                                {cartPackage.name} |{" "}
                                                <strong>
                                                    ${cartPackage.price}
                                                </strong>
                                            </Text>
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
                                    <Divider marginBottom=".5rem" />
                                    {uploadedPdfs.map((pdf) => {
                                        return (
                                            <ListItem
                                                key={pdf.name}
                                                marginBottom=".5rem"
                                            >
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
                                <Text fontSize="1.5rem">
                                    <strong>
                                        Estimated Price: {calculateTotalPrice()}
                                    </strong>
                                </Text>
                            </ListItem>
                            <Button
                                variant="browned"
                                onClick={() => {
                                    if (checkFormValidity()) setModalOpen(true);
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
