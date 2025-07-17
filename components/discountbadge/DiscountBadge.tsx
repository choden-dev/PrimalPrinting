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
				<Badge colorScheme="green">{getPercentOff()}% off!</Badge>
			)}
		</>
	);
}
