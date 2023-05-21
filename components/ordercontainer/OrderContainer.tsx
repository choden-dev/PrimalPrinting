import { useRouter } from "next/router";
import { useState, useRef, useEffect } from "react";
import {
    Box,
    Divider,
    Tab,
    TabIndicator,
    TabList,
    TabPanel,
    TabPanels,
    Tabs,
    useMediaQuery,
} from "@chakra-ui/react";
import ProcessingOverlay from "../processingoverlay/ProcessingOverlay";
import Footer from "../footer/Footer";
import ItemModal from "../itemmodal/ItemModal";
import DetailsForm from "./DetailsForm";
import { CartPackage, OrderRow, UploadedPdf } from "../../types/types";
import Cart from "./Cart";
import PackageOrder from "./PackageOrder";
import PdfOrder from "./PdfOrder";

type Props = {
    packages: any;
};

const OrderContainer = ({ packages }: Props) => {
    const [uploadedPdfs, setUploadedPdfs] = useState<UploadedPdf[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [cartPackages, setCartPackages] = useState<CartPackage[]>([]);
    const [smallScreen] = useMediaQuery(`(max-width: 1000px)`);
    const formRef = useRef(null);
    const router = useRouter();

    const closeModal = () => {
        setModalOpen(false);
    };

    const collateOrder = (
        urls: { name: string; url: string }[],
        isBankTransfer: boolean
    ) => {
        const orders: OrderRow[] = [];

        const form = formRef.current;
        console.log(form);
        const name = form!.name.value;
        const email = form!.email.value;
        const message = form!.message.value;
        const paymentMethod = isBankTransfer ? "Bank" : "Credit Card";

        uploadedPdfs.forEach((pdf) => {
            const idx = urls.findIndex((item) => item.name === pdf.name);
            const order: OrderRow = {
                name,
                email,
                message,
                pages: pdf.pageCount,
                coursebookName: pdf.name,
                quantity: pdf.quantity,
                cost: pdf.price,
                colour: pdf.isColor,
                coursebookLink: urls[idx].url,
                paid: false,
                paymentMethod,
            };
            orders.push(order);
        });

        cartPackages.forEach((cartPackage) => {
            const order: OrderRow = {
                name,
                email,
                message,
                quantity: 1,
                coursebookLink: cartPackage.name,
                cost: cartPackage.price,
                colour: false,
                paid: false,
                paymentMethod,
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

    const handleOrderInformation = (isBankTransfer: boolean) => {
        setModalOpen(false);
        setIsProcessing(true);

        const promises = uploadedPdfs.map((pdf) => {
            const file = pdf.file;
            const reader = new FileReader();

            return new Promise((resolve, reject) => {
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
        });

        Promise.all(promises)
            .then((res) =>
                res.map((item) => ({
                    name: item.message.name,
                    url: item.message.url,
                }))
            )
            .then((temp) => {
                collateOrder(temp, isBankTransfer);
            });
    };

    const payWithCreditCard = (orderId: string) => {
        const items: { price: string; quantity: number }[] = [];

        uploadedPdfs.forEach((pdf) => {
            items.push({ price: pdf.priceId, quantity: pdf.quantity });
        });

        cartPackages.forEach((cartPackage) => {
            items.push({ price: cartPackage.priceId, quantity: 1 });
        });

        if (items.length === 0) return;

        const toPost = {
            items,
            orderId,
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
                    <Tabs variant="enclosed" colorScheme="brown">
                        <TabList padding="0 1rem">
                            <Tab fontWeight="700">Order Packages</Tab>
                            <Tab fontWeight="700">Upload Pdf</Tab>
                        </TabList>
                        <TabPanels>
                            <TabPanel>
                                <PackageOrder
                                    packages={packages}
                                    cartPackages={cartPackages}
                                    setCartPackages={setCartPackages}
                                    smallScreen={smallScreen}
                                />
                            </TabPanel>
                            <TabPanel>
                                <PdfOrder
                                    uploadedPdfs={uploadedPdfs}
                                    setUploadedPdfs={setUploadedPdfs}
                                />
                            </TabPanel>
                        </TabPanels>
                    </Tabs>

                    <DetailsForm formRef={formRef} />
                </Box>
                <Cart
                    cartPackages={cartPackages}
                    setCartPackages={setCartPackages}
                    uploadedPdfs={uploadedPdfs}
                    setUploadedPdfs={setUploadedPdfs}
                    formRef={formRef}
                    smallScreen={smallScreen}
                    setModalOpen={setModalOpen}
                />
            </Box>
            <Footer />
        </>
    );
};

export default OrderContainer;
