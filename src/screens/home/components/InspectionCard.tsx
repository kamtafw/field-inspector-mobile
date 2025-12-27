import { Text, View } from "react-native"
import AntDesign from "@expo/vector-icons/AntDesign"
import database from "@/src/database"
import Inspection from "@/src/database/models/Inspection"
import { withObservables } from "@nozbe/watermelondb/react"

const inspectionsCollection = database.get<Inspection>("inspections")

interface InspectionProp {
	inspection: Inspection
}

function InspectionCard({ inspection }: InspectionProp) {
	const handleDeleteRow = async () => {
		console.log("DELETE:", inspection)

		await inspection.markAsDeleted()
	}

	return (
		<View className="flex-row bg-white p-2 justify-between rounded-md">
			<Text className="text-base font-bold">{inspection.facilityName}</Text>
			<Text className="font-extralight">{inspection.status}</Text>

			<AntDesign name="delete-row" size={16} color="red" onPress={handleDeleteRow} />
		</View>
	)
}

const enhance = withObservables(["inspection"], ({ inspection }: InspectionProp) => ({
	inspection: inspection.observe(),
}))

const EnhancedInspectionCard = enhance(InspectionCard)
export default EnhancedInspectionCard
