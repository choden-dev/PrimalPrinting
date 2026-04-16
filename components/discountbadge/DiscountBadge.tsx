import { Badge } from "@chakra-ui/react";
import { getPercentOff } from "../../lib/utils";

export default function DiscountBadge({
	displayCondition,
}: {
	displayCondition: boolean;
}) {
	return (
		<>
			{displayCondition && (
				// @ts-expect-error — Chakra UI v2 Badge props union is too complex for TS 5.x
				<Badge colorScheme="green">{getPercentOff()}% off!</Badge>
			)}
		</>
	);
}
