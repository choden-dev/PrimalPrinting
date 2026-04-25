"use client";

import {
	Alert,
	AlertIcon,
	Box,
	Button,
	Flex,
	Heading,
	HStack,
	Radio,
	RadioGroup,
	Spinner,
	Text,
	VStack,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

interface PickupProfileInfo {
	id: string;
	name: string;
	shortSummary: string | null;
}

interface Timeslot {
	id: string;
	date: string;
	startTime: string;
	endTime: string;
	label: string;
	maxCapacity: number | null;
	bookedCount: number;
	availableSpots: number | null;
	pickupInstructionProfile: PickupProfileInfo | null;
}

interface TimeslotResponse {
	success: boolean;
	timeslots: Timeslot[];
	total: number;
	limit: number;
	offset: number;
	hasMore: boolean;
}

interface CurrentTimeslot {
	date: string;
	startTime: string;
	endTime: string;
	label?: string;
}

interface TimeslotSelectorProps {
	orderId: string;
	/** If provided, indicates the user is changing an existing timeslot. */
	currentTimeslot?: CurrentTimeslot | null;
	onTimeslotSelected: (
		timeslotId: string,
		pickupInstructions?: unknown[],
	) => void;
	onCancel: () => void;
}

/** Number of timeslots to fetch per page. */
const PAGE_SIZE = 15;

/** Group timeslots by date for display. */
function groupByDate(slots: Timeslot[]): Map<string, Timeslot[]> {
	const map = new Map<string, Timeslot[]>();
	for (const slot of slots) {
		const dateKey =
			typeof slot.date === "string" ? slot.date.split("T")[0] : "";
		const existing = map.get(dateKey);
		if (existing) {
			existing.push(slot);
		} else {
			map.set(dateKey, [slot]);
		}
	}
	return map;
}

/** Format a date string into a user-friendly label. */
function formatDateHeading(dateStr: string): string {
	try {
		return new Date(dateStr).toLocaleDateString("en-NZ", {
			weekday: "long",
			day: "numeric",
			month: "long",
			year: "numeric",
		});
	} catch {
		return dateStr;
	}
}

/** Fetch a page of pickup timeslots from the API. */
async function fetchTimeslots(page: number): Promise<TimeslotResponse> {
	const offset = page * PAGE_SIZE;
	const res = await fetch(
		`/api/pickup-slots?limit=${PAGE_SIZE}&offset=${offset}`,
	);
	if (!res.ok) {
		throw new Error("Failed to load timeslots");
	}
	return res.json();
}

/**
 * Component to select a pickup timeslot for an order.
 * Fetches available timeslots using React Query with server-side
 * pagination. Displays them grouped by date with Previous/Next controls.
 * Shows capacity info and pickup instruction profile names.
 */
export function TimeslotSelector({
	orderId,
	currentTimeslot,
	onTimeslotSelected,
	onCancel,
}: TimeslotSelectorProps) {
	const isChanging = !!currentTimeslot;
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [page, setPage] = useState(0);

	const { data, isLoading, isError, error, isPlaceholderData } = useQuery({
		queryKey: ["pickup-slots", page],
		queryFn: () => fetchTimeslots(page),
		placeholderData: (prev) => prev,
	});

	const timeslots = data?.timeslots ?? [];
	const total = data?.total ?? 0;
	const hasMore = data?.hasMore ?? false;
	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

	// Group the current page's timeslots by date
	const grouped = useMemo(() => groupByDate(timeslots), [timeslots]);

	// Handle timeslot selection submission
	const handleSubmit = useCallback(async () => {
		if (!selectedId) return;

		try {
			setSubmitting(true);
			setSubmitError(null);
			const res = await fetch(`/api/shop/${orderId}/select-timeslot`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ timeslotId: selectedId }),
			});

			if (!res.ok) {
				const errData = await res.json();
				throw new Error(errData.error || "Failed to select timeslot");
			}

			const resData = await res.json();
			onTimeslotSelected(
				selectedId,
				resData.pickupInstructionProfile?.instructions,
			);
		} catch (err) {
			setSubmitError(err instanceof Error ? err.message : "Unknown error");
		} finally {
			setSubmitting(false);
		}
	}, [selectedId, orderId, onTimeslotSelected]);

	if (isLoading) {
		return (
			<Box py={10} textAlign="center">
				<Spinner size="lg" color="brown.700" />
				<Text mt={3} color="gray.500">
					Loading timeslots...
				</Text>
			</Box>
		);
	}

	if (isError) {
		return (
			<Box p={5}>
				<Alert status="error" mb={3} borderRadius="md">
					<AlertIcon />
					{error instanceof Error ? error.message : "Unknown error"}
				</Alert>
				<Button variant="outline" onClick={onCancel}>
					Back
				</Button>
			</Box>
		);
	}

	if (total === 0) {
		return (
			<Box p={5}>
				<Text mb={3}>No timeslots available at the moment.</Text>
				<Text fontSize="sm" color="gray.500" mb={4}>
					We&apos;ll notify you by email when pickup slots become available.
				</Text>
				<Button variant="outline" onClick={onCancel}>
					Back
				</Button>
			</Box>
		);
	}

	return (
		<Box
			py={2}
			opacity={isPlaceholderData ? 0.6 : 1}
			transition="opacity 0.15s ease"
		>
			<Heading size="md" mb={4}>
				{isChanging ? "Change Pickup Timeslot" : "Select a Pickup Timeslot"}
			</Heading>

			{/* Show current timeslot when changing */}
			{isChanging && currentTimeslot && (
				<Box
					p={4}
					mb={5}
					bg="orange.50"
					borderRadius="lg"
					borderLeft="4px solid"
					borderLeftColor="orange.400"
				>
					<Text fontSize="xs" fontWeight={700} color="orange.700" mb={1}>
						CURRENT TIMESLOT
					</Text>
					<Text fontWeight={600} fontSize="sm">
						{formatDateHeading(
							currentTimeslot.date.includes("T")
								? currentTimeslot.date.split("T")[0]
								: currentTimeslot.date,
						)}
					</Text>
					<Text fontSize="sm" color="gray.600">
						{currentTimeslot.startTime} – {currentTimeslot.endTime}
						{currentTimeslot.label ? ` · ${currentTimeslot.label}` : ""}
					</Text>
				</Box>
			)}

			{submitError && (
				<Alert status="error" mb={3} borderRadius="md">
					<AlertIcon />
					{submitError}
				</Alert>
			)}

			<RadioGroup
				value={selectedId ?? ""}
				onChange={(val) => setSelectedId(val)}
			>
				{Array.from(grouped.entries()).map(([dateKey, slots]) => (
					<Box key={dateKey} mb={5}>
						<Text
							fontSize="sm"
							fontWeight={600}
							color="gray.700"
							mb={2}
							pb={1}
							borderBottom="1px solid"
							borderColor="gray.200"
						>
							{formatDateHeading(dateKey)}
						</Text>
						<VStack spacing={2} align="stretch">
							{slots.map((slot) => {
								const isSelected = selectedId === slot.id;
								return (
									<Box
										as="label"
										key={slot.id}
										p={3}
										border={isSelected ? "2px solid" : "1px solid"}
										borderColor={isSelected ? "blue.600" : "gray.200"}
										borderRadius="lg"
										cursor="pointer"
										bg={isSelected ? "blue.50" : "white"}
										transition="all 0.15s ease"
										_hover={{
											borderColor: isSelected ? "blue.600" : "gray.300",
										}}
									>
										<Flex align="center" gap={3}>
											<Radio value={slot.id} colorScheme="blue" />
											<Box flex={1}>
												<Text fontWeight={600} fontSize="sm">
													{slot.startTime} – {slot.endTime}
													{slot.label ? ` · ${slot.label}` : ""}
												</Text>
												<HStack spacing={3} mt={1}>
													{/* Capacity indicator */}
													<Text fontSize="xs" color="gray.500">
														{slot.availableSpots !== null ? (
															<>
																<Text
																	as="span"
																	fontWeight={500}
																	color={
																		slot.availableSpots <= 2
																			? "orange.700"
																			: "green.700"
																	}
																>
																	{slot.availableSpots}
																</Text>{" "}
																spot
																{slot.availableSpots !== 1 ? "s" : ""} remaining
															</>
														) : (
															"Open availability"
														)}
													</Text>

													{/* Pickup method */}
													{slot.pickupInstructionProfile && (
														<Text fontSize="xs" color="blue.600">
															📍 {slot.pickupInstructionProfile.name}
														</Text>
													)}
												</HStack>
											</Box>
										</Flex>
									</Box>
								);
							})}
						</VStack>
					</Box>
				))}
			</RadioGroup>

			{/* Pagination controls */}
			{totalPages > 1 && (
				<HStack justify="center" spacing={3} mb={4}>
					<Button
						size="sm"
						variant="outline"
						onClick={() => setPage((p) => Math.max(0, p - 1))}
						isDisabled={page === 0}
					>
						← Previous
					</Button>
					<Text fontSize="sm" color="gray.500">
						Page {page + 1} of {totalPages}
					</Text>
					<Button
						size="sm"
						variant="outline"
						onClick={() => setPage((p) => p + 1)}
						isDisabled={!hasMore}
					>
						Next →
					</Button>
				</HStack>
			)}

			<HStack spacing={3} mt={5}>
				<Button
					colorScheme="blue"
					onClick={handleSubmit}
					isDisabled={!selectedId || submitting}
					isLoading={submitting}
					loadingText={isChanging ? "Updating..." : "Confirming..."}
				>
					{isChanging ? "Update Timeslot" : "Confirm Timeslot"}
				</Button>
				<Button variant="outline" onClick={onCancel}>
					Cancel
				</Button>
			</HStack>
		</Box>
	);
}

export default TimeslotSelector;
