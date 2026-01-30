import React from "react"
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from "react-native"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { SafeAreaView } from "react-native-safe-area-context"
import clsx from "clsx"

import database from "@/src/database"
import useInspections from "@/src/hooks/useInspections"
import EmptyState from "@/src/components/ui/EmptyState"
import { MainStackParamList } from "@/src/navigation/types"
import useInspectionDetail from "@/src/hooks/useInspectionDetail"
import SyncRepository from "@/src/database/repositories/SyncRepository"
import { InspectionDetailSkeleton } from "@/src/components/ui/SkeletonLoader"

type FailedInspectionProp = RouteProp<MainStackParamList, "FailedInspection">
type NavigationProp = NativeStackNavigationProp<MainStackParamList>

export default function FailedInspectionScreen() {
	const navigation = useNavigation<NavigationProp>()
	const route = useRoute<FailedInspectionProp>()
	const { inspectionId } = route.params

	const { updateInspection, submitInspection, deleteInspection } = useInspections()
	const { inspection, isLoading, error } = useInspectionDetail(inspectionId)

	const handleRetryManually = async () => {
		if (!inspection) return

		Alert.alert(
			"Retry Sync",
			"This will attempt to sync again. Make sure you're online and the issue is resolved.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Retry",
					onPress: async () => {
						try {
							await updateInspection(inspection.id, { status: "submitted" })

							const ops = await SyncRepository.getByEntityId(inspection.id)
							for (const op of ops) {
								if (op.status === "failed") {
									await database.write(async () => {
										await op.markAsDeleted()
									})
								}
							}

							Alert.alert("Success", "Sync queued. Check status in a moment.")
						} catch (err) {
							Alert.alert("Error", "Failed to queue sync")
						}
					},
				},
			],
		)
	}

	const handleExportData = async () => {
		if (!inspection) return

		const exportData = {
			id: inspection.id,
			facilityName: inspection.facilityName,
			facilityAddress: inspection.facilityAddress,
			responses: inspection.responses,
			createdTs: inspection.createdTs,
			submittedTs: inspection.submittedTs,
			syncError: inspection.syncError,
		}

		const jsonString = JSON.stringify(exportData, null, 2)

		Alert.alert("Export Data", "Data copied to clipboard. Send to support for manual recovery.", [
			{
				text: "Copy",
				onPress: () => {
					// Clipboard.setString(jsonString)
					console.log("Exported:", jsonString)
				},
			},
			{ text: "Cancel", style: "cancel" },
		])
	}

	const handleDeletePermanently = async () => {
		if (!inspection) return

		Alert.alert(
			"Delete Inspection",
			"This will permanently delete this inspection. This cannot be undone. Export data first if needed.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Delete",
					style: "destructive",
					onPress: async () => {
						await deleteInspection(inspection.id)
					},
				},
			],
		)
	}

	if (isLoading) {
		return (
			<SafeAreaView className="flex-1 bg-background">
				<View className="flex-row justify-between items-center p-4 pt-12 bg-white border-b border-b-[#e0e0e0]">
					<TouchableOpacity onPress={() => navigation.goBack()}>
						<Text className="text-base text-[#007AFA] w-14">← Back</Text>
					</TouchableOpacity>
					<Text className="text-lg text-[#1a1a1a] font-semibold">Failed Sync</Text>
					<View className="w-14" />
				</View>

				<InspectionDetailSkeleton />
			</SafeAreaView>
		)
	}

	if (!inspection) {
		return (
			<SafeAreaView className="flex-1 bg-background">
				<View className="flex-1 justify-center items-center p-8">
					<Text className="text-6xl mb-4">✅</Text>
					<Text className="text-xl font-semibold text-gray-900 mb-2">No Failed Syncs</Text>
					<Text className="text-sm text-gray-600 text-center">
						All inspections are syncing properly
					</Text>
				</View>
			</SafeAreaView>
		)
	}

	if (!inspection) {
		return (
			<SafeAreaView className="flex-1 bg-background">
				<View className="flex-row justify-between items-center p-4 pt-12 bg-white border-b border-b-[#e0e0e0]">
					<TouchableOpacity onPress={() => navigation.goBack()}>
						<Text className="text-base text-[#007AFA] w-14">← Back</Text>
					</TouchableOpacity>
					<Text className="text-lg text-[#1a1a1a] font-semibold">Failed Sync</Text>
					<View className="w-14" />
				</View>

				<EmptyState icon="📋" title="No Inspection" message="Inspection does not exist" />
			</SafeAreaView>
		)
	}

	const responses = JSON.parse(JSON.stringify(inspection.responses))

	return (
		<SafeAreaView className="flex-1 bg-background">
			{/* Header */}
			<View className="flex-row justify-between items-center p-4 pt-12 bg-white border-b border-b-[#e0e0e0]">
				<TouchableOpacity onPress={() => navigation.goBack()}>
					<Text className="text-base text-[#007AFA] w-14">← Back</Text>
				</TouchableOpacity>
				<Text className="text-lg text-[#1a1a1a] font-semibold">Failed Sync</Text>
				<View className="w-14" />
			</View>

			<ScrollView className="flex-1 scrollView" contentContainerClassName="p-4 pb-24">
				{/* Failure info */}
				<View className="bg-[#fff3cc] rounded-xl p-4 mb-4 border border-[#ffc107] ">
					<Text className="text-base text-[#856404] font-semibold mb-2">What happened?</Text>
					<Text className="text-sm text-[#856404] mb-3">{inspection.syncError}</Text>
				</View>

				{/* Field-by-field comparison */}
				<View className="bg-white rounded-xl p-4 mb-4">
					<View className="flex-row justify-between items-center mb-5">
						<Text className="text-lg text-[#1a1a1a] font-semibold">Inspection Details</Text>
						<Text className="text-xs text-gray-500">
							{new Date(inspection.submittedTs || 0).toLocaleString()}
						</Text>
					</View>

					{/* Facility Name */}
					<View className="flex-row items-center justify-between mb-3">
						<Text className="text-sm text-[#666] font-semibold">Facility Name:</Text>
						<Text className="text-sm text-[#1a1a1a] font-semibold">{inspection.facilityName}</Text>
					</View>

					<View className="border-b border-[#e0e0e0] mb-3" />

					{/* Facility Address */}
					<View className="flex-row items-center justify-between mb-3">
						<Text className="text-sm text-[#666] font-semibold">Facility Address:</Text>
						<Text className="text-sm text-[#1a1a1a] font-semibold">
							{inspection.facilityAddress}
						</Text>
					</View>

					<View className="border-b border-[#e0e0e0] mb-3" />

					{/* Status */}
					<View className="flex-row items-center justify-between mb-3">
						<Text className="text-sm text-[#666] font-semibold">Status:</Text>
						<View className="bg-[#FFF3E0] px-3 py-1.5 rounded-full">
							<Text className="text-xs text-[#ff9500] font-semibold">⚠️ Sync Failed</Text>
						</View>
					</View>

					<View className="border-b border-[#e0e0e0] mb-3" />

					{/* Version */}
					<View className="flex-row items-center justify-between mb-3">
						<Text className="text-sm text-[#666] font-semibold">Version:</Text>
						<Text className="text-sm text-[#1a1a1a] font-semibold">v{inspection.version}</Text>
					</View>

					<View className="border-b border-[#e0e0e0] mb-3" />

					{/* Checklist Items */}
					<View className="flex-1 mb-3">
						<Text className="text-sm text-[#666] font-semibold">Checklist Items:</Text>

						{Object.keys(responses).length === 0 ? (
							<Text className="ml-24 text-sm text-[#1a1a1a] font-semibold">
								No checklist responses yet
							</Text>
						) : (
							Object.entries(responses).map(([itemId, response]: [string, any]) => (
								<View key={itemId} className="ml-24 mb-4 border-b border-[#f0f0f0] last:border-b-0">
									<View className="flex-row items-center justify-between">
										<Text className="text-sm text-[#1a1a1a] font-semibold">Item: {itemId}</Text>

										<View
											className={clsx(
												"px-3 py-1.5 rounded-full",
												response.value.toLowerCase() === "pass"
													? "bg-[#e8f8ec]"
													: response.value.toLowerCase() === "fail"
														? "bg-[#ffebee]"
														: "bg-[#f0f0f0]",
											)}
										>
											<Text
												className={clsx(
													"text-sm font-semibold",
													response.value.toLowerCase() === "pass"
														? "text-[#34c759]"
														: response.value.toLowerCase() === "fail"
															? "text-[#ff3b30]"
															: "text-[#666]",
												)}
											>
												{response.value}
											</Text>
										</View>
									</View>
								</View>
							))
						)}
					</View>
				</View>
			</ScrollView>

			<View className="flex-row gap-2 bg-white p-4 border-t border-t-[#e0e0e0]">
				<TouchableOpacity
					className="flex-1 bg-blue-600 p-3 rounded-lg"
					onPress={handleRetryManually}
				>
					<Text className="text-white text-xs font-semibold text-center">Retry Sync</Text>
				</TouchableOpacity>

				<TouchableOpacity className="flex-1 bg-gray-200 p-3 rounded-lg" onPress={handleExportData}>
					<Text className="text-gray-700 text-xs font-semibold text-center">Export Data</Text>
				</TouchableOpacity>

				<TouchableOpacity
					className="flex-1 bg-red-100 p-3 rounded-lg"
					onPress={handleDeletePermanently}
				>
					<Text className="text-red-600 text-xs font-semibold text-center">Delete</Text>
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	)
}
