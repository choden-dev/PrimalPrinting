import { Box, Heading } from "@chakra-ui/react";
import ProductCard from "../productcard/ProductCard";

type Props = {
    packages: any;
    cartPackages: any[];
    setCartPackages: (T: any[]) => void;
    smallScreen: boolean;
};

const PackageOrder = ({
    packages,
    cartPackages,
    setCartPackages,
    smallScreen,
}: Props) => {
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
    return (
        <Box display="flex" flexDir="column" gap="1rem">
            <Heading>Products</Heading>
            <Box
                display="grid"
                gridTemplateColumns={smallScreen ? "1fr" : "1fr 1fr"}
            >
                {packages &&
                    packages.map((item: any) => {
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
        </Box>
    );
};

export default PackageOrder;
