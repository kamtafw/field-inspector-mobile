import React, { useState, useEffect } from "react"
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { clsx } from "clsx"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import InspectionRepository from "@/src/database/repositories/InspectionRepository"
import ConflictRepository from "@/src/database/repositories/ConflictRepository"
import ConflictResolver from "@/src/services/sync/ConflictDetector"
import SyncEngine from "@/src/services/sync/SyncEngine"
import { MainStackParamList } from "@/src/navigation/types"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import Conflict from "@/src/database/models/Conflict"

type ConflictResolutionProp = RouteProp<MainStackParamList, "ConflictResolution">
type NavigationProp = NativeStackNavigationProp<MainStackParamList>

type ResolutionStrategy = "keep_mine" | "keep_theirs" | "merge"
type MergedData = {
	facilityName: string
	facilityAddress: string
	responses: any
	status: any
	version: any
}

function formatTimeAgo(timestamp: number): string {
	const now = Date.now()
	const diffMs = now - timestamp
	const diffMins = Math.floor(diffMs / 60000)
	const diffHours = Math.floor(diffMs / 3600000)
	const diffDays = Math.floor(diffMs / 86400000)

	if (diffMins < 1) return "Just now"
	if (diffMins === 1) return "1 minute ago"
	if (diffMins < 60) return `${diffMins} minutes ago`
	if (diffHours === 1) return "1 hour ago"
	if (diffHours < 24) return `${diffHours} hours ago`
	if (diffDays === 1) return "Yesterday"
	if (diffDays < 7) return `${diffDays} days ago`

	// format as date for older changes
	return new Date(timestamp).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: diffDays > 365 ? "numeric" : undefined,
	})
}

type FieldSelection = {
	[fieldName: string]: "client" | "server"
}

export default function ConflictResolutionScreen() {
	const route = useRoute<ConflictResolutionProp>()
	const navigation = useNavigation<NavigationProp>()
	const { inspectionId } = route.params

	const [conflict, setConflict] = useState<Conflict | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [isResolving, setIsResolving] = useState(false)

	const [strategy, setStrategy] = useState<ResolutionStrategy | null>(null)
	const [mergedData, setMergedData] = useState<MergedData | null>(null)

	const [fieldSelections, setFieldSelections] = useState<FieldSelection>({})

	useEffect(() => {
		loadConflict()
	}, [inspectionId])

	const loadConflict = async () => {
		try {
			setIsLoading(true)
			const conflicts = await ConflictRepository.getByInspectionId(inspectionId)

			if (conflicts.length === 0) {
				Alert.alert("No Conflict", "This inspection has no pending conflicts.")
				navigation.goBack()
				return
			}

			const recentConflict = conflicts[0]
			setConflict(recentConflict)

			const analysis = ConflictResolver.analyzeConflict(
				recentConflict.clientData,
				recentConflict.serverData,
				recentConflict.conflictFields,
			)

			setStrategy(analysis.suggestedStrategy)

			setMergedData({
				facilityName: recentConflict.serverData.facilityName,
				facilityAddress: recentConflict.serverData.facilityAddress,
				responses: { ...recentConflict.serverData.responses },
				status: recentConflict.serverData.status,
				version: recentConflict.serverData.version,
			})

			const initialSelections: FieldSelection = {}

			if (recentConflict.conflictFields.includes("facility_name")) {
				initialSelections["facility_name"] = "server"
			}
			if (recentConflict.conflictFields.includes("facility_address")) {
				initialSelections["facility_address"] = "server"
			}
			if (recentConflict.conflictFields.includes("status")) {
				initialSelections["status"] = "server"
			}

			recentConflict.conflictFields
				.filter((f: string) => f.startsWith("responses."))
				.forEach((fieldKey: string) => {
					const itemId = fieldKey.replace("responses.", "")
					initialSelections[`responses.${itemId}`] = "server"
				})

			setFieldSelections(initialSelections)
		} catch (err) {
			console.error("Failed to load conflict:", err)
			Alert.alert("Error", "Failed to load conflict details")
		} finally {
			setIsLoading(false)
		}
	}

	const toggleFieldSelection = (fieldName: string, currentSelection: "client" | "server") => {
		if (!conflict || !mergedData) return

		const newSelection = currentSelection === "client" ? "server" : "client"

		setFieldSelections((prev) => ({
			...prev,
			[fieldName]: newSelection,
		}))

		if (fieldName === "facilityName") {
			setMergedData({
				...mergedData,
				facilityName:
					newSelection === "client"
						? conflict.clientData.facilityName
						: conflict.serverData.facilityName,
			})
		} else if (fieldName === "facilityAddress") {
			setMergedData({
				...mergedData,
				facilityAddress:
					newSelection === "client"
						? conflict.clientData.facilityAddress
						: conflict.serverData.facilityAddress,
			})
		} else if (fieldName === "status") {
			setMergedData({
				...mergedData,
				status: newSelection === "client" ? conflict.clientData.status : conflict.serverData.status,
			})
		} else if (fieldName.startsWith("responses.")) {
			const itemId = fieldName.replace("responses.", "")
			const newResponses = { ...mergedData.responses }

			newResponses[itemId] =
				newSelection === "client"
					? conflict.clientData.responses[itemId]
					: conflict.serverData.responses[itemId]

			setMergedData({
				...mergedData,
				responses: newResponses,
			})
		}
	}

	const handleResolve = async () => {
		if (!conflict || !mergedData) return

		if (!strategy) {
			Alert.alert("Error", "Please select a resolution strategy")
			return
		}

		setIsResolving(true)

		try {
			let finalData: any

			// determine final data based on strategy
			switch (strategy) {
				case "keep_mine":
					finalData = conflict.clientData
					break
				case "keep_theirs":
					finalData = conflict.serverData
					break
				case "merge":
					finalData = mergedData
					break
			}

			// update local inspection with resolved data
			await InspectionRepository.update(inspectionId, {
				facilityName: finalData.facilityName,
				facilityAddress: finalData.facilityAddress,
				responses: finalData.responses,
				status: "submitted",
				version: conflict.serverVersion,
			})

			// mark conflict as resolved
			await ConflictRepository.markResolved(conflict.id, strategy)

			Alert.alert("Conflict Resolved", "Your changes have been saved and will sync when online.", [
				{
					text: "OK",
					onPress: async () => navigation.goBack(),
				},
			])
		} catch (err: any) {
			console.error("Failed to resolve conflict:", err)
			Alert.alert("Error", err.message || "Failed to resolve conflict")
		} finally {
			setIsResolving(false)
		}
	}

	const renderFieldComparison = (
		fieldName: string,
		label: string,
		clientValue: any,
		serverValue: any,
		isConflict: boolean,
	) => {
		const currentSelection = fieldSelections[fieldName] || "server"
		const isMergeMode = strategy === "merge"

		const stateStyles = {
			strategy: "bg-[#d4edda] border-2 border-[#28a745]",
			merge: "bg-[#e3f2fd] border-2 border-[#007aff]",
			conflict: "bg-[#fff3e0] border-2 border-[#ff9500]",
			default: "bg-[#f9f9f9] border border-[#e0e0e0]",
		}

		return (
			<View className="mb-5">
				<Text className="text-sm text-[#666] font-semibold mb-2">{label}</Text>

				<View className="flex-row gap-3">
					{/* Client value */}
					<TouchableOpacity
						className={clsx(
							"flex-1 rounded-lg p-3",
							strategy === "keep_mine"
								? stateStyles.strategy
								: isMergeMode && currentSelection === "client"
									? stateStyles.merge
									: isConflict
										? stateStyles.conflict
										: stateStyles.default,
						)}
						onPress={() => {
							if (isMergeMode && isConflict) {
								toggleFieldSelection(fieldName, currentSelection)
							}
						}}
						disabled={!isMergeMode || !isConflict}
					>
						<View className="flex-row justify-between items-center mb-2">
							<Text className="text-xs text-[#999] uppercase font-semibold">Your Version</Text>
							{isMergeMode && isConflict && currentSelection === "client" && (
								<Text className="text-sm text-[#007aff]">✓</Text>
							)}
						</View>
						<Text className="text-sm text-[#1a1a1a]">{String(clientValue || "N/A")}</Text>
					</TouchableOpacity>

					{/* Server value */}
					<TouchableOpacity
						className={clsx(
							"flex-1 rounded-lg p-3",
							strategy === "keep_theirs"
								? stateStyles.strategy
								: isMergeMode && currentSelection === "server"
									? stateStyles.merge
									: isConflict
										? stateStyles.conflict
										: stateStyles.default,
						)}
						onPress={() => {
							if (isMergeMode && isConflict) {
								toggleFieldSelection(fieldName, currentSelection)
							}
						}}
						disabled={!isMergeMode || !isConflict}
					>
						<View className="flex-row justify-between items-center mb-2">
							<Text className="text-xs text-[#999] uppercase font-semibold">Server Version</Text>
							{isMergeMode && isConflict && currentSelection === "server" && (
								<Text className="text-sm text-[#007aff]">✓</Text>
							)}
						</View>
						<Text className="text-sm text-[#1a1a1a]">{String(serverValue || "N/A")}</Text>
					</TouchableOpacity>
				</View>

				{isConflict && (
					<View className="mt-2 p-2 bg-[#fff3cd] rounded-md">
						<Text className="text-xs text-[#856404] font-medium">
							{isMergeMode ? "⚠️ Tap to select which version to keep" : "⚠️ Conflict detected"}
						</Text>
					</View>
				)}
			</View>
		)
	}

	if (isLoading) {
		return (
			<View className="flex-1 justify-center items-center p-5">
				<ActivityIndicator size="large" color="#007AFF" />
				<Text className="mt-3 text-base text-[#666]">Loading conflict...</Text>
			</View>
		)
	}

	if (!conflict || !mergedData) {
		return (
			<View className="flex-1 justify-center items-center p-5">
				<Text className="text-base text-[#ff3b30]">No conflict data available</Text>
			</View>
		)
	}

	const detailedConflicts = conflict.detailedConflicts || []

	return (
		<SafeAreaView className="flex-1 bg-background">
			{/* Header */}
			<View className="flex-row justify-between items-center p-4 pt-12 bg-white border-b border-b-[#e0e0e0]">
				<TouchableOpacity onPress={() => navigation.goBack()}>
					<Text className="text-base text-[#007AFA] w-14">← Back</Text>
				</TouchableOpacity>
				<Text className="text-lg text-[#1a1a1a] font-semibold">Resolve Conflict</Text>
				<View className="w-14" />
			</View>

			<ScrollView className="flex-1 scrollView" contentContainerClassName="p-4 pb-24">
				{/* Conflict info */}
				<View className="bg-[#fff3cc] rounded-xl p-4 mb-4 border border-[#ffc107] ">
					<Text className="text-base text-[#856404] font-semibold mb-2">What happened?</Text>
					<Text className="text-sm text-[#856404] mb-3">
						This inspection was edited by another user while you were offline. You need to choose
						which changes to keep.
					</Text>

					{conflict.serverUpdatedByName && (
						<View className="bg-white rounded-lg p-3 mb-3">
							<Text className="text-xs text-[#666] mb-1">Server changes made by:</Text>
							<Text className="text-sm text-[#1a1a1a] font-semibold">
								{conflict.serverUpdatedByName}
							</Text>
							{conflict.serverUpdatedByEmail && (
								<Text className="text-xs text-[#666] mt-1">{conflict.serverUpdatedByEmail}</Text>
							)}
							{conflict.serverUpdatedTs && (
								<Text className="text-xs text-[#666] mt-1">
									{formatTimeAgo(conflict.serverUpdatedTs)}
								</Text>
							)}
						</View>
					)}

					<View className="flex-row gap-2">
						<View className="bg-white px-4 py-2 rounded-2xl">
							<Text className="text-sm text-[#856404] font-semibold">
								Your version: v{conflict.clientVersion}
							</Text>
						</View>
						<View className="bg-white px-3 py-2 rounded-2xl">
							<Text className="text-sm text-[#856404] font-semibold">
								Server version: v{conflict.serverVersion}
							</Text>
						</View>
					</View>
				</View>

				{/* Resolution strategy selector */}
				<View className="bg-white rounded-xl p-4 mb-4">
					<Text className="text-lg text-[#1a1a1a] font-semibold mb-4">
						Choose Resolution Strategy
					</Text>

					<TouchableOpacity
						className={clsx(
							"border-2 rounded-xl p-4 mb-3",
							strategy === "keep_mine"
								? "bg-[#e3f2fd] border-[#007aff]"
								: "bg-[#f9f9f9] border-[#e0e0e0]",
						)}
						onPress={() => setStrategy("keep_mine")}
					>
						<Text
							className={clsx(
								"text-base font-semibold mb-1",
								strategy === "keep_mine" ? "text-[#007aff]" : "text-[#1a1a1a]",
							)}
						>
							Keep My Changes
						</Text>
						<Text className="text-sm text-[#666]">Discard server changes, use your version</Text>
					</TouchableOpacity>

					<TouchableOpacity
						className={clsx(
							"border-2 rounded-xl p-4 mb-3",
							strategy === "keep_theirs"
								? "bg-[#e3f2fd] border-[#007aff]"
								: "bg-[#f9f9f9] border-[#e0e0e0]",
						)}
						onPress={() => setStrategy("keep_theirs")}
					>
						<Text
							className={clsx(
								"text-base font-semibold mb-1",
								strategy === "keep_theirs" ? "text-[#007aff]" : "text-[#1a1a1a]",
							)}
						>
							Keep Server Changes
						</Text>
						<Text className="text-sm text-[#666]">Discard your changes, use server version</Text>
					</TouchableOpacity>

					<TouchableOpacity
						className={clsx(
							"border-2 rounded-xl p-4 mb-3",
							strategy === "merge"
								? "bg-[#e3f2fd] border-[#007aff]"
								: "bg-[#f9f9f9] border-[#e0e0e0]",
						)}
						onPress={() => setStrategy("merge")}
					>
						<Text
							className={clsx(
								"text-base font-semibold mb-1",
								strategy === "merge" ? "text-[#007aff]" : "text-[#1a1a1a]",
							)}
						>
							Merge Both (Review Required)
						</Text>
						<Text className="text-sm text-[#666]">Combine changes field-by-field</Text>
					</TouchableOpacity>
				</View>

				{/* Field-by-field comparison */}
				<View className="bg-white rounded-xl p-4 mb-4">
					<Text className="text-lg text-[#1a1a1a] font-semibold mb-4">Field Comparison</Text>

					{/* Facility Name */}
					{renderFieldComparison(
						"facilityName",
						"Facility Name",
						conflict.clientData.facilityName,
						conflict.serverData.facilityName,
						conflict.conflictFields.includes("facility_name"),
					)}

					<View className="border-b border-[#e0e0e0] mb-3" />

					{/* Facility Address */}
					{renderFieldComparison(
						"facilityAddress",
						"Facility Address",
						conflict.clientData.facilityAddress,
						conflict.serverData.facilityAddress,
						conflict.conflictFields.includes("facility_address"),
					)}

					<View className="border-b border-[#e0e0e0] mb-3" />

					{/* Status */}
					{renderFieldComparison(
						"status",
						"Status",
						conflict.clientData.status,
						conflict.serverData.status,
						conflict.conflictFields.includes("status"),
					)}

					{/* Checklist items with conflicts */}
					{detailedConflicts
						.filter((c: any) => c.field.startsWith("responses."))
						.map((conflictItem: any) => {
							const itemId = conflictItem.field.replace("responses.", "")
							return (
								<View key={itemId}>
									<View className="border-b border-[#e0e0e0] mb-3" />
									{renderFieldComparison(
										`responses.${itemId}`,
										`Checklist Item: ${itemId}`,
										conflictItem.clientValue?.value,
										conflictItem.serverValue?.value,
										true,
									)}
								</View>
							)
						})}
				</View>
			</ScrollView>

			{/* Resolve button */}
			<View className="bg-white p-4 border-t border-t-[#e0e0e0]">
				<TouchableOpacity
					className={clsx("bg-[#007aff] p-4 rounded-lg items-center", isResolving && "opacity-60")}
					onPress={handleResolve}
					disabled={isResolving}
				>
					{isResolving ? (
						<ActivityIndicator color="#fff" />
					) : (
						<Text className="text-base text-white font-semibold">Resolve Conflict</Text>
					)}
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	)
}
