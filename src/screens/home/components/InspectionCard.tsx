import { Text, TouchableOpacity, View } from "react-native"
import database from "@/src/database"
import Inspection from "@/src/database/models/Inspection"
import { withObservables } from "@nozbe/watermelondb/react"
import InspectionsAPI from "@/src/services/api/inspections.api"
import InspectionRepository from "@/src/database/repositories/InspectionRepository"

interface InspectionProp {
	inspection: Inspection
}

function StatusBadge({ status }: { status: string }) {
	const getBadgeStyle = () => {
		switch (status) {
			case "draft":
				return { backgroundColor: "bg-[#e0e0e0]", color: "text-[#666]" }
			case "submitted":
				return { backgroundColor: "bg-[#fff3cd]", color: "text-[#856404]" }
			case "synced":
				return { backgroundColor: "bg-[#d4edda]", color: "text-[#155724]" }
			case "conflict":
				return { backgroundColor: "bg-[#f8d7da]", color: "text-[#721c24]" }
			default:
				return { backgroundColor: "bg-[#e0e0e0]", color: "text-[#666]" }
		}
	}

	const badgeStyle = getBadgeStyle()

	return (
		<View className={`px-3 py-1 rounded-xl ${badgeStyle.backgroundColor}`}>
			<Text className={`text-xs font-bold capitalize ${badgeStyle.color}`}>{status}</Text>
		</View>
	)
}

function InspectionCard({ inspection }: InspectionProp) {
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

		console.log("It worked!")
	}

	return (
		<TouchableOpacity
			onPress={handleSyncInspection}
			className="bg-white rounded-xl p-4 mb-3 shadow-md"
		>
			<View className="flex-row mb-2 items-center justify-between">
				<Text className="flex-1 text-lg font-semibold text-[#1a1a1a]">
					{inspection.facilityName}
				</Text>
				<StatusBadge status={inspection.status} />
			</View>
			<Text className="text-sm text-[#666] mb-2">{inspection.facilityAddress}</Text>
			<Text className="text-xs text-[#999]">
				{new Date(inspection.createdTs).toLocaleDateString("en-US", {
					month: "short",
					day: "numeric",
					year: "numeric",
				})}
			</Text>
			{!inspection.isSynced && (
				<View className="flex-row items-center mt-2 pt-2 border-t border-[#f0f0f0]">
					<View className="w-2 h-2 rounded bg-[#ff9500] mr-2" />
					<Text className=" rounded text-[#ff9500] font-medium">Not synced</Text>
				</View>
			)}
		</TouchableOpacity>
	)
}

const enhance = withObservables(["inspection"], ({ inspection }: InspectionProp) => ({
	inspection: inspection.observe(),
}))

const EnhancedInspectionCard = enhance(InspectionCard)
export default EnhancedInspectionCard
