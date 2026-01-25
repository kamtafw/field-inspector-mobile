import Inspection from "@/src/database/models/Inspection"
import InspectionRepository from "@/src/database/repositories/InspectionRepository"
import useInspectionDetail from "@/src/hooks/useInspectionDetail"
import useInspections from "@/src/hooks/useInspections"
import { MainStackParamList } from "@/src/navigation/types"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { clsx } from "clsx"
import { useEffect, useState } from "react"
import {
	ActivityIndicator,
	Alert,
	ScrollView,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import PhotoGallery from "./components/PhotoGallery"
import EmptyState from "@/src/components/ui/EmptyState"
import { InspectionDetailSkeleton } from "@/src/components/ui/SkeletonLoader"

type InspectionDetailRouteProp = RouteProp<MainStackParamList, "InspectionDetail">
type NavigationProp = NativeStackNavigationProp<MainStackParamList>

export default function InspectionDetailScreen() {
	const route = useRoute<InspectionDetailRouteProp>()
	const navigation = useNavigation<NavigationProp>()
	const { id } = route.params

	const { updateInspection, submitInspection } = useInspections()
	const { inspection, isLoading, error } = useInspectionDetail(id)

	const [isEditing, setIsEditing] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)

	const [facilityName, setFacilityName] = useState("")
	const [facilityAddress, setFacilityAddress] = useState("")
	const [responses, setResponses] = useState<any>({})

	useEffect(() => {
		if (inspection) {
			setFacilityName(inspection.facilityName)
			setFacilityAddress(inspection.facilityAddress)
			setResponses(inspection.responses || {})

			if (inspection.status === "draft") {
				setIsEditing(true)
			}
		}
	}, [inspection?.id])

	useEffect(() => {
		if (error) {
			Alert.alert("Error", error)
			navigation.goBack()
		}
	}, [error])

	const handleSave = async () => {
		if (!inspection) return

		try {
			setIsSaving(true)

			await updateInspection(inspection.id, {
				facilityName,
				facilityAddress,
				responses,
			})

			Alert.alert("Success", "Changes saved")
			setIsEditing(false)
		} catch (err: any) {
			console.error("Failed to save:", err)
			Alert.alert("Error", err.message || "Failed to save changes")
		} finally {
			setIsSaving(false)
		}
	}

	const handleSubmit = async () => {
		if (!inspection) return

		Alert.alert(
			"Submit Inspection",
			"Once submitted, this inspection will be synced to the server. Continue?",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Submit",
					style: "default",
					onPress: async () => {
						try {
							setIsSubmitting(true)
							await submitInspection(inspection.id)
							Alert.alert("Success", "Inspection submitted and queued for sync")
							navigation.goBack()
						} catch (err: any) {
							Alert.alert("Error", err.message || "Failed to submit")
						} finally {
							setIsSubmitting(false)
						}
					},
				},
			]
		)
	}

	const handleDelete = async () => {
		if (!inspection) return

		Alert.alert(
			"Delete Inspection",
			"Are you sure you want to delete this inspection? This cannot be undone.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Delete",
					style: "destructive",
					onPress: async () => {
						try {
							await InspectionRepository.delete(inspection.id)
							Alert.alert("Success", "Inspection deleted")
							navigation.goBack()
						} catch (err: any) {
							Alert.alert("Error", err.message || "Failed to delete")
						}
					},
				},
			]
		)
	}

	const handleChecklistResponse = (itemId: string, value: string) => {
		setResponses({
			...responses,
			[itemId]: {
				value,
				timestamp: Date.now(),
			},
		})
	}

	const getStatusBadge = () => {
		if (!inspection) return { label: "", color: "", bgColor: "" }

		switch (inspection.status) {
			case "draft":
				return { label: "Draft", color: "#666", bgColor: "#F0F0F0" }
			case "submitted":
				return inspection.isSynced
					? { label: "Synced ✓", color: "#34C759", bgColor: "#E8F8EC" }
					: { label: "Pending Sync", color: "#FF9500", bgColor: "#FFF3E0" }
			case "synced":
				return { label: "Synced ✓", color: "#34C759", bgColor: "#E8F8EC" }
			case "conflict":
				return { label: "⚠️ Conflict", color: "#FF3B30", bgColor: "#FFEBEE" }
			default:
				return { label: inspection.status, color: "#666", bgColor: "#F0F0F0" }
		}
	}

	if (isLoading) {
		return (
			<SafeAreaView className="flex-1 bg-background">
				<View className="flex-row justify-between items-center p-5 pt-10 bg-white border-b border-[#e0e0e0]">
					<TouchableOpacity onPress={() => navigation.goBack()}>
						<Text className="text-base text-[#007aff]">← Back</Text>
					</TouchableOpacity>

					<View className="flex-1 mx-4">
						<Text className="text-lg font-semibold text-center text-[#1a1a1a]">
							Inspection Details
						</Text>
					</View>
				</View>

				<InspectionDetailSkeleton />
			</SafeAreaView>
		)
	}

	if (!inspection) {
		return (
			<SafeAreaView className="flex-1 bg-background">
				<View className="flex-row justify-between items-center p-5 pt-10 bg-white border-b border-[#e0e0e0]">
					<TouchableOpacity onPress={() => navigation.goBack()}>
						<Text className="text-base text-[#007aff]">← Back</Text>
					</TouchableOpacity>

					<View className="flex-1 mx-4">
						<Text className="text-lg font-semibold text-center text-[#1a1a1a]">
							Inspection Details
						</Text>
					</View>
				</View>

				<EmptyState icon="📋" title="No Inspection" message="Inspection does not exist" />
			</SafeAreaView>
		)
	}

	const badge = getStatusBadge()
	const canEdit = inspection.status === "draft" || inspection.status === "conflict"
	const canSubmit = inspection.status === "draft"
	const canDelete = inspection.status === "draft"
	const canAddPhotos =
		inspection.status === "draft" ||
		inspection.status === "submitted" ||
		inspection.status === "synced"

	return (
		<SafeAreaView className="flex-1 bg-background">
			{/* Header */}
			<View className="bg-white border-b border-[#e0e0e0]">
				<View className="flex-row justify-between items-center p-4">
					<TouchableOpacity onPress={() => navigation.goBack()}>
						<Text className="text-base text-[#007aff]">← Back</Text>
					</TouchableOpacity>

					<View className="flex-1 mx-4">
						<Text className="text-lg font-semibold text-center text-[#1a1a1a]">
							Inspection Details
						</Text>
					</View>

					{canEdit && !isEditing && (
						<TouchableOpacity onPress={() => setIsEditing(true)}>
							<Text className="text-base text-[#007aff]">Edit</Text>
						</TouchableOpacity>
					)}
					{!canEdit && <View className="w-12" />}
				</View>

				{/* Status Badge */}
				<View className="px-4 pb-4 flex-row items-center justify-between">
					<View className="px-3 py-1.5 rounded-full" style={{ backgroundColor: badge.bgColor }}>
						<Text className="text-sm font-semibold">{badge.label}</Text>
					</View>

					<Text className="text-sm text-[#666]">Version {inspection.version}</Text>
				</View>

				{/* Conflict Warning */}
				{inspection.status === "conflict" && (
					<TouchableOpacity
						className="mx-4 mb-4 p-3 bg-[#fff3e0] border border-[#ff9500] rounded-lg"
						onPress={() =>
							navigation.navigate("ConflictResolution", { inspectionId: inspection.id })
						}
					>
						<Text className="text-sm text-[#ff9500] font-semibold">
							⚠️ This inspection has unresolved conflicts
						</Text>
						<Text className="text-xs text-[#ff9500] mt-1">Tap to resolve</Text>
					</TouchableOpacity>
				)}
			</View>

			<ScrollView className="flex-1" contentContainerClassName="p-4 pb-24">
				{/* Facility Information */}
				<View className="bg-white rounded-xl p-4 mb-4">
					<Text className="text-lg text-[#1a1a1a] font-semibold mb-4">Facility Information</Text>

					{/* Facility Name */}
					<View className="mb-4">
						<Text className="text-sm text-[#666] font-semibold mb-2">Facility Name</Text>
						{isEditing ? (
							<TextInput
								className="border border-[#e0e0e0] rounded-lg p-3 text-base text-[#1a1a1a]"
								value={facilityName}
								onChangeText={setFacilityName}
								placeholder="Enter facility name"
								editable={canEdit}
							/>
						) : (
							<Text className="text-base text-[#1a1a1a]">{facilityName}</Text>
						)}
					</View>

					{/* Facility Address */}
					<View className="mb-4">
						<Text className="text-sm text-[#666] font-semibold mb-2">Facility Address</Text>
						{isEditing ? (
							<TextInput
								className="border border-[#e0e0e0] rounded-lg p-3 text-base text-[#1a1a1a]"
								value={facilityAddress}
								onChangeText={setFacilityName}
								placeholder="Enter facility address"
								editable={canEdit}
							/>
						) : (
							<Text className="text-base text-[#1a1a1a]">{facilityAddress}</Text>
						)}
					</View>

					{/* Timestamps */}
					<View className="mt-2 pt-4 border-t border-[#e0e0e0]">
						<Text className="text-xs text-[#999]">
							Created: {new Date(inspection.createdTs).toLocaleString()}
						</Text>
						{inspection.submittedTs && (
							<Text className="text-xs text-[#999] mt-1">
								Submitted: {new Date(inspection.submittedTs).toLocaleString()}
							</Text>
						)}
						{inspection.syncedTs && (
							<Text className="text-xs text-[#999] mt-1">
								Submitted: {new Date(inspection.syncedTs).toLocaleString()}
							</Text>
						)}
					</View>
				</View>

				{/* Checklist Responses */}
				<View className="bg-white rounded-xl p-4 mb-4">
					<Text className="text-lg font-semibold text-[#1a1a1a] mb-4">Checklist</Text>

					{Object.keys(responses).length === 0 ? (
						<Text className="text-sm text-[#999] italic">No checklist responses yet</Text>
					) : (
						Object.entries(responses).map(([itemId, response]: [string, any]) => (
							<View key={itemId} className="mb-4 pb-4 border-b border-[#f0f0f0] last:border-b-0">
								<Text className="text-sm text-[#666] font-semibold mb-2">Item: {itemId}</Text>

								{isEditing ? (
									<View className="flex-row gap-2">
										{["Pass", "Fail", "N/A"].map((option) => (
											<TouchableOpacity
												key={option}
												className={clsx(
													"flex-1 p-3 rounded-lg border-2",
													response.value === option
														? "bg-[#007aff] border-[#007aff]"
														: "bg-white border-[#e0e0e0]"
												)}
												onPress={() => handleChecklistResponse(itemId, option)}
												disabled={!canEdit}
											>
												<Text
													className={clsx(
														"text-center font-semibold",
														response.value === option ? "text-white" : "text-[#666]"
													)}
												>
													{option}
												</Text>
											</TouchableOpacity>
										))}
									</View>
								) : (
									<View className="flex-row items-center">
										<View
											className={clsx(
												"px-3 py-1.5 rounded-full",
												response.value === "pass"
													? "bg-[#e8f8ec]"
													: response.value === "fail"
													? "bg-[#ffebee]"
													: "bg-[#f0f0f0]"
											)}
										>
											<Text
												className={clsx(
													"text-sm font-semibold",
													response.value.toLowerCase() === "pass"
														? "text-[#34c759]"
														: response.value.toLowerCase() === "fail"
														? "text-[#ff3b30]"
														: "text-[#666]"
												)}
											>
												{response.value}
											</Text>
										</View>
										{response.timestamp && (
											<Text className="text-xs text-[#999] ml-3">
												{new Date(response.timestamp).toLocaleString()}
											</Text>
										)}
									</View>
								)}
							</View>
						))
					)}
				</View>

				{/* Photos Section */}
				<PhotoGallery inspectionId={inspection.id} canEdit={canAddPhotos} />

				{/* Sync Error Display */}
				{inspection.syncError && (
					<View className="bg-[#ffebee] rounded-xl p-4 mb-4 border border-[#ff3b30]">
						<Text className="text-sm text-[#ff3b30] font-semibold mb-1">Sync Error</Text>
						<Text className="text-xs text-[#ff3b30]">{inspection.syncError}</Text>
					</View>
				)}
			</ScrollView>

			{/* Action Buttons */}
			{(canEdit || canSubmit || canDelete) && (
				<View className="bg-white p-4 border-t border-[#e0e0e0]">
					{isEditing && canEdit && (
						<View className="flex-row gap-3 mb-3">
							<TouchableOpacity
								className="flex-1 p-4 rounded-lg border border-[#e0e0e0] items-center"
								onPress={() => {
									setIsEditing(false)
									setFacilityName(inspection.facilityName)
									setFacilityAddress(inspection.facilityAddress)
									setResponses(inspection.responses || {})
								}}
							>
								<Text className="text-base font-semibold text-[#666]">Cancel</Text>
							</TouchableOpacity>

							<TouchableOpacity
								className={clsx(
									"flex-1 p-4 rounded-lg items-center",
									isSaving ? "bg-[#999]" : "bg-[#007aff]"
								)}
								onPress={handleSave}
								disabled={isSaving}
							>
								{isSaving ? (
									<ActivityIndicator color="#ff" />
								) : (
									<Text className="text-base font-semibold text-white">Save Changes</Text>
								)}
							</TouchableOpacity>
						</View>
					)}

					{canSubmit && !isEditing && (
						<TouchableOpacity
							className={clsx(
								"p-4 rounded-lg items-center mb-3",
								isSubmitting ? "bg-[#999]" : "bg-[#34c759]"
							)}
							onPress={handleSubmit}
							disabled={isSubmitting}
						>
							{isSubmitting ? (
								<ActivityIndicator color="#fff" />
							) : (
								<Text className="text-base font-semibold text-white">Submit Inspection</Text>
							)}
						</TouchableOpacity>
					)}

					{canDelete && (
						<TouchableOpacity
							className="p-4 rounded-lg border border-[#ff3b30] items-center"
							onPress={handleDelete}
						>
							<Text className="text-base font-semibold text-[#ff3b30]">Delete Inspection</Text>
						</TouchableOpacity>
					)}
				</View>
			)}
		</SafeAreaView>
	)
}
