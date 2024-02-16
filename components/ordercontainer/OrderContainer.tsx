import { useRouter } from "next/router";
import { useState, useRef, useEffect, useContext } from "react";
import {
  Box,
  Tab,
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
import { formatItems, orderSum } from "../../lib/utils";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import storage from "../../firebase";
import { CartContext, CartContextProvider } from "../../contexts/CartContext";
import ExtraInfo from "./ExtraInfo";
type Props = {
  packages: any;
};

const OrderContainer = ({ packages }: Props) => {
  return (
    <CartContextProvider>
      <OrderContainerInner packages={packages} />
    </CartContextProvider>
  );
};

const OrderContainerInner = ({ packages }: Props) => {
  const { cartPackages, uploadedPdfs, setIsModalOpen, isModalOpen } =
    useContext(CartContext);

  const [currentlyUploading, setCurrentlyUploading] = useState<
    { name: string; percent: number }[]
  >([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [smallScreen] = useMediaQuery(`(max-width: 1000px)`);
  const formRef = useRef(null);
  const router = useRouter();

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const uploadPdf = (
    file: File,
    name: string,
    index: number
  ): Promise<{ name: string; url: string }> => {
    const prevArray = [...currentlyUploading];
    prevArray.push({ name: name, percent: 0 });
    return new Promise((resolve, reject) => {
      const storageRef = ref(storage, `files/${name}`);
      const uploadWorker = uploadBytesResumable(storageRef, file);

      uploadWorker.on(
        "state_changed",
        (snapshot) => {
          const percent = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );
          setCurrentlyUploading((prevItems) => {
            const updatedItems = [...prevItems];
            updatedItems[index] = { name: name, percent: percent };
            return updatedItems;
          });
        },
        (err) => {
          console.error(err);
          reject(err);
        },
        () => {
          getDownloadURL(uploadWorker.snapshot.ref)
            .then((url) => {
              console.log(url);
              resolve({ name: name, url: url });
            })
            .catch((err) => {
              console.error(err);
              reject(err);
            });
        }
      );
    });
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
        quantity: cartPackage.getQuantity(),
        coursebookLink: cartPackage.displayName,
        cost: cartPackage.getDisplayPrice(),
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
        const emailInfo = {
          email: formRef.current.email.value,
          name: formRef.current.name.value,
          orderId: data.message.orderId,
          items: formatItems(data.message.coursebooks),
          price: orderSum(data.message.coursebooks),
        };
        if (isBankTransfer) {
          setIsProcessing(false);
          fetch(`api/sendemailbank`, {
            method: "POST",
            body: JSON.stringify(emailInfo),
          }).then(() => {
            router.push(
              `/order_complete?orderId=${
                data.message.orderId
              }&items=${JSON.stringify(data.message.coursebooks)}`
            );
          });
        } else {
          setIsProcessing(false);
          payWithCreditCard(data.message.orderId);
        }
      })
    );
  };

  const handleOrderInformation = (isBankTransfer: boolean) => {
    closeModal();
    setIsProcessing(true);

    const promises = uploadedPdfs.map((pdf, index) => {
      const file = pdf.file;
      const fileName = pdf.name;
      return uploadPdf(file, fileName, index);
    });

    let tempItems = [];
    Promise.all(promises)
      .then((res) => {
        res.map((item) =>
          tempItems.push({
            name: item.name,
            url: item.url,
          })
        );
      })
      .then(() => {
        collateOrder(tempItems, isBankTransfer);
      });
  };

  const payWithCreditCard = (orderId: string) => {
    const items: { price: string; quantity: number; productId: string }[] = [];

    uploadedPdfs.forEach((pdf) => {
      items.push({
        price: pdf.priceId,
        quantity: pdf.getQuantity(),
        productId: pdf.productId,
      });
    });

    cartPackages.forEach((cartPackage) => {
      items.push({
        price: cartPackage.priceId,
        quantity: cartPackage.getQuantity(),
        productId: cartPackage.id,
      });
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
        if (data && data.paymentLink) window.location.replace(data.paymentLink);
        else console.log("Sorry, a package seems to have been withdrawan");
      });
    });
  };

  return (
    <>
      <ProcessingOverlay show={isProcessing} items={currentlyUploading} />
      <ItemModal
        isOpen={isModalOpen}
        closeFunction={closeModal}
        creditCard={() => handleOrderInformation(false)}
        bankTransfer={() => handleOrderInformation(true)}
      />
      <ExtraInfo />
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
                  displayPackages={packages}
                  smallScreen={smallScreen}
                />
              </TabPanel>
              <TabPanel>
                <PdfOrder />
              </TabPanel>
            </TabPanels>
          </Tabs>

          <DetailsForm formRef={formRef} />
        </Box>
        <Cart formRef={formRef} smallScreen={smallScreen} />
      </Box>
      <Footer />
    </>
  );
};

export default OrderContainer;
