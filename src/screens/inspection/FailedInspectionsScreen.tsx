import { useState, useEffect } from "react"
import { View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import InspectionRepository from "@/src/database/repositories/InspectionRepository"
import SyncRepository from "@/src/database/repositories/SyncRepository"
import Inspection from "@/src/database/models/Inspection"
import { Q } from "@nozbe/watermelondb"
import database from "@/src/database"

export default function FailedInspectionsScreen() {
	const [failedInspections, setFailedInspections] = useState<Inspection[]>([])
	const [isLoading, setIsLoading] = useState(true)

	useEffect(() => {
		loadFailedInspections()
	}, [])

	const loadFailedInspections = async () => {
		try {
			setIsLoading(true)
			const syncFailed = await InspectionRepository.getSyncFailed()
			const failed = await InspectionRepository.collection
				.query(Q.where("status", "sync_failed"))
				.fetch()
			setFailedInspections(syncFailed)
		} catch (err) {
			console.error("Failed to load failed inspections:", err)
		} finally {
			setIsLoading(false)
		}
	}

	const handleRetryManually = async (inspection: Inspection) => {
		Alert.alert(
			"Retry Sync",
			"This will attempt to sync again. Make sure you're online and the issue is resolved.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Retry",
					onPress: async () => {
						try {
							// Reset status to submitted
							await InspectionRepository.update(inspection.id, { status: "submitted" })

							// Delete old failed sync operations
							const ops = await SyncRepository.getByEntityId(inspection.id)
							for (const op of ops) {
								if (op.status === "failed") {
									await database.write(async () => {
										await op.markAsDeleted()
									})
								}
							}

							// Create new sync operation
							await InspectionRepository.submitInspection(inspection.id)

							Alert.alert("Success", "Sync queued. Check status in a moment.")
							loadFailedInspections()
						} catch (err) {
							Alert.alert("Error", "Failed to queue sync")
						}
					},
				},
			],
		)
	}

	const handleExportData = async (inspection: Inspection) => {
		// Export inspection data as JSON for manual recovery
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

		// Copy to clipboard or share
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

	const handleDeletePermanently = async (inspection: Inspection) => {
		Alert.alert(
			"Delete Inspection",
			"This will permanently delete this inspection. This cannot be undone. Export data first if needed.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Delete",
					style: "destructive",
					onPress: async () => {
						await InspectionRepository.delete(inspection.id)
						loadFailedInspections()
					},
				},
			],
		)
	}

	const renderFailedInspection = ({ item }: { item: Inspection }) => (
		<View className="bg-white p-4 m-4 rounded-xl border-2 border-red-500">
			<View className="flex-row justify-between items-center mb-3">
				<View className="bg-red-500 px-3 py-1 rounded-full">
					<Text className="text-white text-xs font-bold">⚠️ SYNC FAILED</Text>
				</View>
				<Text className="text-xs text-gray-500">
					{new Date(item.submittedTs || 0).toLocaleString()}
				</Text>
			</View>

			<Text className="text-lg font-semibold text-gray-900 mb-2">{item.facilityName}</Text>

			<Text className="text-sm text-gray-600 mb-4">{item.facilityAddress}</Text>

			<View className="bg-red-50 p-3 rounded-lg mb-4">
				<Text className="text-xs text-red-700 font-semibold mb-1">Failure Reason:</Text>
				<Text className="text-xs text-red-600">{item.syncError || "Unknown error"}</Text>
			</View>

			<View className="flex-row gap-2">
				<TouchableOpacity
					className="flex-1 bg-blue-600 p-3 rounded-lg"
					onPress={() => handleRetryManually(item)}
				>
					<Text className="text-white text-xs font-semibold text-center">Retry Sync</Text>
				</TouchableOpacity>

				<TouchableOpacity
					className="flex-1 bg-gray-200 p-3 rounded-lg"
					onPress={() => handleExportData(item)}
				>
					<Text className="text-gray-700 text-xs font-semibold text-center">Export Data</Text>
				</TouchableOpacity>

				<TouchableOpacity
					className="flex-1 bg-red-100 p-3 rounded-lg"
					onPress={() => handleDeletePermanently(item)}
				>
					<Text className="text-red-600 text-xs font-semibold text-center">Delete</Text>
				</TouchableOpacity>
			</View>
		</View>
	)

	if (isLoading) {
		return (
			<SafeAreaView className="flex-1 bg-background">
				<View className="flex-1 justify-center items-center">
					<ActivityIndicator size="large" color="#ef4444" />
					<ActivityIndicator size="large" color="#ef4444" />y
					<Text className="mt-3 text-gray-600">Loading failed syncs...</Text>
				</View>
			</SafeAreaView>
		)
	}

	if (failedInspections.length === 0) {
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

	return (
		<SafeAreaView className="flex-1 bg-background">
			<View className="bg-white p-5 pt-14 border-b border-gray-200">
				<Text className="text-3xl font-bold text-gray-900">Failed Syncs</Text>
				<Text className="text-sm text-red-600 font-medium mt-1">
					{failedInspections.length} inspection{failedInspections.length > 1 ? "s" : ""} need
					attention
				</Text>
			</View>

			<FlatList
				data={failedInspections}
				renderItem={renderFailedInspection}
				keyExtractor={(item) => item.id}
				contentContainerClassName="pb-4"
			/>
		</SafeAreaView>
	)
}
