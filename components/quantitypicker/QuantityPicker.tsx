import {
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputProps,
  NumberInputStepper,
} from "@chakra-ui/react";

export default function QuantityPicker(props: NumberInputProps) {
  const { max, defaultValue, min, width, onChange } = props;

  return (
    <>
      <NumberInput
        size={"sm"}
        onChange={onChange}
        max={max ?? 999}
        defaultValue={defaultValue ?? 1}
        min={min ?? 1}
        width={width ?? "4rem"}
      >
        <NumberInputField />
        <NumberInputStepper>
          <NumberIncrementStepper />
          <NumberDecrementStepper />
        </NumberInputStepper>
      </NumberInput>
    </>
  );
}
