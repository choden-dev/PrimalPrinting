import { Box, Heading } from "@chakra-ui/react";
import ProductCard from "../productcard/ProductCard";
import { IAddOrder } from "../../types/helper";
import { CartPackage } from "../../types/types";
import CartItem from "../../types/models/CartItem";

type Props = {
  displayPackages: any;
  cartPackages: CartItem[];
  setCartPackages: (cartPackages: CartItem[]) => void;
  smallScreen: boolean;
};

const PackageOrder = ({
  displayPackages,
  cartPackages,
  setCartPackages,
  smallScreen,
}: Props) => {
  const addPackage: IAddOrder = (
    id: string,
    name: string,
    priceId: string,
    price: number,
    quantity: number
  ) => {
    const temp = [...cartPackages];
    if (temp.find((item) => item.id === id)) return;
    temp.push(new CartItem(id, name, quantity, price, priceId));
    setCartPackages(temp);
  };
  return (
    <Box display="flex" flexDir="column" gap="1rem">
      <Heading textAlign="center">Choose a Package</Heading>
      <Box display="grid" gridTemplateColumns={smallScreen ? "1fr" : "1fr 1fr"}>
        {displayPackages &&
          displayPackages.map((displayPackage: any) => {
            const { name, id, default_price, description, price, features } =
              displayPackage;
            return (
              <ProductCard
                key={displayPackage.updated}
                addFunction={addPackage}
                orderPackage={{
                  title: name,
                  id: id,
                  priceId: default_price,
                  description: description,
                  price: price / 100,
                  features: features,
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
