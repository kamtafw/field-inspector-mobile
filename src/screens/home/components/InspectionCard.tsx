import { Text, TouchableOpacity, View } from "react-native"
import Inspection from "@/src/database/models/Inspection"
import { withObservables } from "@nozbe/watermelondb/react"
import InspectionsAPI from "@/src/services/api/inspections.api"
import InspectionRepository from "@/src/database/repositories/InspectionRepository"
import SyncEngine from "@/src/services/sync/SyncEngine"
import { useNavigation } from "@react-navigation/native"

interface InspectionProp {
	inspection: Inspection
}

function StatusBadge({ status }: { status: string }) {
	const getBadgeStyle = () => {
		switch (status) {
			case "draft":
				return { label: "Draft", bgColor: "bg-[#e0e0e0]", color: "text-[#666]" }
			case "submitted":
				return { label: "Submitted", bgColor: "bg-[#fff3e0]", color: "text-[#ff9500]" }
			case "synced":
				return { label: "Synced ✓", bgColor: "bg-[#d4edda]", color: "text-[#155724]" }
			case "conflict":
				return { label: "⚠️ Conflict", bgColor: "bg-[##ff3b30]", color: "text-[#fff]" }
			default:
				return { label: status, bgColor: "bg-[#e0e0e0]", color: "text-[#666]" }
		}
	}

	const badgeStyle = getBadgeStyle()

	return (
		<View className={`px-2 py-1 rounded-md ${badgeStyle.bgColor}`}>
			<Text className={`text-xs font-bold capitalize ${badgeStyle.color}`}>{badgeStyle.label}</Text>
		</View>
	)
}

function InspectionCard({ inspection }: InspectionProp) {
	const navigation = useNavigation()

	const handlePress = () => {
		if (inspection.status === "conflict") {
			navigation.navigate("ConflictResolution", { inspectionId: inspection.id })
		} else {
		}
	}

	const handleSyncInspection = async () => {
		const response = await InspectionsAPI.create(
			{
				template_id: inspection.templateId,
				facility_name: inspection.facilityName,
				facility_address: inspection.facilityAddress,
				responses: inspection.responses,
				status: "draft",
				version: inspection.version,
			},
			"e0df5cf5-f17e-4118-8b41-ba9c8528afe8"
		)

		await InspectionRepository.markSynced(inspection.id, response.id, response.version)
	}

	const handleUpdateInspection = async () => {
		await InspectionRepository.update(inspection.id, {
			facilityName: "Working App",
			facilityAddress: "Working Address",
			status: "submitted",
		})

		SyncEngine.process()
	}

	const formattedDate = new Date(inspection.createdTs).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	})

	return (
		<TouchableOpacity
			onPress={handlePress}
			className="flex-row bg-white items-center p-4 border-b border-b-[#e0e0e0] shadow-md"
			activeOpacity={0.7}
		>
			<View className="flex-1">
				<View className="flex-row items-center justify-between mb-1">
					<Text className="flex-1 text-base text-black font-semibold mr-2" numberOfLines={1}>
						{inspection.facilityName}
					</Text>
					<StatusBadge status={inspection.status} />
				</View>

				<Text className="text-sm text-[#666] mb-2" numberOfLines={1}>
					{inspection.facilityAddress}
				</Text>

				<View className="flex-row items-center justify-between">
					<Text className="text-xs text-[#999]">{formattedDate}</Text>
					<Text className="text-xs text-[#999] font-medium">v{inspection.version}</Text>
				</View>

				{inspection.status === "conflict" && (
					<View className="bg-red-50 mt-2 p-2 rounded border-l-4 border-l-[#ff3b30]">
						<Text className="text-xs text-[#ff3b30] font-semibold">Tap to resolve conflict</Text>
					</View>
				)}
			</View>

			<View className="ml-3">
				<Text className="text-2xl text-[#c7c7c7]">›</Text>
			</View>
		</TouchableOpacity>
	)
}

const enhance = withObservables(["inspection"], ({ inspection }: InspectionProp) => ({
	inspection: inspection.observe(),
}))

const EnhancedInspectionCard = enhance(InspectionCard)
export default EnhancedInspectionCard
