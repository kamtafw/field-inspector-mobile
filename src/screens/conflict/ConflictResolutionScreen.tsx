import React, { useState, useEffect } from "react"
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { v4 as uuid4 } from "uuid"
import { clsx } from "clsx"
import { useNavigation, useRoute } from "@react-navigation/native"
import ConflictRepository from "@/src/database/repositories/ConflictRepository"
import InspectionRepository from "@/src/database/repositories/InspectionRepository"
import SyncRepository from "@/src/database/repositories/SyncRepository"
import ConflictResolver from "@/src/services/sync/ConflictDetector"
import database from "@/src/database"

export type StrategyType = "keep_mine" | "keep_theirs" | "merge"

export default function ConflictResolutionScreen() {
	const navigation = useNavigation()
	const route = useRoute()
	const { conflict, inspection } = route.params as any

	const [selectedStrategy, setSelectedStrategy] = useState<StrategyType | null>(null)
	const [mergedData, setMergedData] = useState<any>(null)
	const [isResolving, setIsResolving] = useState(false)

	useEffect(() => {
		// analyze conflict and suggest strategy
		const analysis = ConflictResolver.analyzeConflict(
			conflict.clientData,
			conflict.serverData,
			conflict.conflictFields
		)

		setSelectedStrategy(analysis.suggestedStrategy)

		// pre-populate merged data
		if (analysis.autoMergeable) {
			const autoMerged = ConflictResolver.autoMerge(
				conflict.clientData,
				conflict.serverData,
				conflict.conflictFields
			)
			setMergedData(autoMerged)
		} else {
			// default to server data for manual merge
			setMergedData({ ...conflict.serverData })
		}
	}, [])

	const handleResolve = async () => {
		if (!selectedStrategy) {
			Alert.alert("Error", "Please select a resolution strategy")
			return
		}

		setIsResolving(true)

		try {
			let finalData: any

			// determine final data based on strategy
			switch (selectedStrategy) {
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
			await InspectionRepository.update(inspection.id, {
				facilityName: finalData.facilityName,
				facilityAddress: finalData.facilityAddress,
				responses: finalData.responses,
				status: finalData.status,
			})

			// mark conflict as resolved
			await ConflictRepository.markResolved(conflict.id, selectedStrategy)

			// queue update operation to sync resolution to server
			const syncCollection = SyncRepository.collection
			await database.write(async () => {
				await syncCollection.create((record: any) => {
					record.operationType = "UPDATE_INSPECTION"
					record.entityId = inspection.id
					record.entityType = "inspection"
					record.idempotencyKey = uuid4()
					record.payload = JSON.stringify({
						remoteId: inspection.remoteId,
						...finalData,
						version: conflict.serverVersion,
					})
					record.status = "pending"
					record.retryCount = 0
					record.maxRetries = 5
				})
			})

			Alert.alert("Success", "Conflict resolved!", [
				{
					text: "OK",
					onPress: () => navigation.goBack(),
				},
			])
		} catch (error: any) {
			Alert.alert("Error", error.message)
		} finally {
			setIsResolving(false)
		}
	}

	const renderFieldComparison = (
		label: string,
		clientValue: any,
		serverValue: any,
		isConflict: boolean
	) => {
		const stateStyles = {
			strategy: "bg-[#d4edda] border-2 border-[#28a745]",
			conflict: "bg-[#f9f9f9] border-2 border-[#ff9500]",
			default: "bg-[#f9f9f9] border border-[#e0e0e0]",
		}

		return (
			<View className="mb-5">
				<Text className="text-sm text-[#666] font-semibold mb-2">{label}</Text>

				<View className="flex-row gap-3">
					{/* Client value */}
					<View
						className={clsx(
							"flex-1 rounded-lg p-3",
							selectedStrategy === "keep_mine"
								? stateStyles.strategy
								: isConflict
								? stateStyles.conflict
								: stateStyles.default
						)}
					>
						<Text className="text-xs text-[#999] uppercase font-semibold mb-2">Your Version</Text>
						<Text className="text-sm text-[#1a1a1a]">{String(clientValue || "N/A")}</Text>
					</View>
					{/* Server value */}
					<View
						className={clsx(
							"flex-1 rounded-lg p-3",
							selectedStrategy === "keep_theirs"
								? stateStyles.strategy
								: isConflict
								? stateStyles.conflict
								: stateStyles.default
						)}
					>
						<Text className="text-xs text-[#999] uppercase font-semibold mb-2">Server Version</Text>
						<Text className="text-sm text-[#1a1a1a]">{String(serverValue || "N/A")}</Text>
					</View>
				</View>

				{isConflict && (
					<View className="mt-2 p-2 bg-[#fff3cd] rounded-md">
						<Text className="text-xs text-[#856404] font-medium">⚠️ Conflict detected</Text>
					</View>
				)}
			</View>
		)
	}

	const detailedConflicts = conflict.detailedConflicts

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

			<ScrollView className="flex-1" contentContainerClassName="p-4 pb-24">
				{/* Conflict info */}
				<View className="bg-[#fff3cc] rounded-xl p-4 mb-4 border border-[#ffc107] ">
					<Text className="text-base text-[#856404] font-semibold mb-2">What happened?</Text>
					<Text className="text-sm text-[#856404] mb-3">
						This inspection was edited by another user while you were offline. You need to choose
						which changes to keep.
					</Text>
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
							selectedStrategy === "keep_mine"
								? "bg-[#e3f2fd] border-[#007aff]"
								: "bg-[#f9f9f9] border-[#e0e0e0]"
						)}
						onPress={() => setSelectedStrategy("keep_mine")}
					>
						<Text
							className={clsx(
								"text-base font-semibold mb-1",
								selectedStrategy === "keep_mine" ? "text-[#007aff]" : "text-[#1a1a1a]"
							)}
						>
							Keep My Changes
						</Text>
						<Text className="text-sm text-[#666]">Discard server changes, use your version</Text>
					</TouchableOpacity>

					<TouchableOpacity
						className={clsx(
							"border-2 rounded-xl p-4 mb-3",
							selectedStrategy === "keep_theirs"
								? "bg-[#e3f2fd] border-[#007aff]"
								: "bg-[#f9f9f9] border-[#e0e0e0]"
						)}
						onPress={() => setSelectedStrategy("keep_theirs")}
					>
						<Text
							className={clsx(
								"text-base font-semibold mb-1",
								selectedStrategy === "keep_theirs" ? "text-[#007aff]" : "text-[#1a1a1a]"
							)}
						>
							Keep Server Changes
						</Text>
						<Text className="text-sm text-[#666]">Discard your changes, use server version</Text>
					</TouchableOpacity>

					<TouchableOpacity
						className={clsx(
							"border-2 rounded-xl p-4 mb-3",
							selectedStrategy === "merge"
								? "bg-[#e3f2fd] border-[#007aff]"
								: "bg-[#f9f9f9] border-[#e0e0e0]"
						)}
						onPress={() => setSelectedStrategy("merge")}
					>
						<Text
							className={clsx(
								"text-base font-semibold mb-1",
								selectedStrategy === "merge" ? "text-[#007aff]" : "text-[#1a1a1a]"
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
						"Facility Name",
						conflict.clientData.facilityName,
						conflict.serverData.facilityName,
						conflict.conflictFields.includes("facility_name")
					)}

					{/* Facility Address */}
					{renderFieldComparison(
						"Facility Address",
						conflict.clientData.facilityAddress,
						conflict.serverData.facilityAddress,
						conflict.conflictFields.includes("facility_address")
					)}

					{/* Status */}
					{renderFieldComparison(
						"Status",
						conflict.clientData.status,
						conflict.serverData.status,
						conflict.conflictFields.includes("status")
					)}

					{/* Checklist items with conflicts */}
					{detailedConflicts
						.filter((c: any) => c.field.startsWith("responses."))
						.map((conflictItem: any) => {
							const itemId = conflictItem.field.replace("responses.", "")
							return (
								<View key={itemId}>
									{renderFieldComparison(
										`Checklist Item: ${itemId}`,
										conflictItem.clientValue?.value,
										conflictItem.serverValue?.value,
										true
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
