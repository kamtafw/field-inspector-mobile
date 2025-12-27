import { FlatList, Text, View } from "react-native"
import InspectionCard from "./InspectionCard"
import database from "@/src/database"
import Inspection from "@/src/database/models/Inspection"
import { withObservables } from "@nozbe/watermelondb/react"

export interface InspectionProps {
	id: string
	facilityName: string
	status: "draft" | "submitted" | "synced" | "conflict"
	isSynced: boolean
	createdAt: number | null
	updatedAt: number | null
}

function inspectionToProps(inspection: Inspection): InspectionProps {
	return {
		id: inspection.id,
		facilityName: inspection.facilityName,
		status: inspection.status,
		isSynced: inspection.isSynced,
		createdAt: inspection.createdAt.getTime(),
		updatedAt: inspection.updatedAt.getTime(),
	}
}

const inspectionsCollection = database.get<Inspection>("inspections")

function InspectionList({ inspections }: { inspections: Inspection[] }) {
	return (
		<View className="flex-auto">
			{/* Headers */}
			<View className="flex-row p-3 justify-between">
				<Text>Facility</Text>
				<Text>Status</Text>
				<Text />
			</View>

			{/* Inspections */}
			<FlatList
				data={inspections}
				contentContainerStyle={{ gap: 5 }}
				renderItem={({ item }) => <InspectionCard inspection={item} />}
			/>
		</View>
	)
}

const enhance = withObservables([], () => ({
	inspections: inspectionsCollection.query(),
}))

const EnhancedInspectionList = enhance(InspectionList)
export default EnhancedInspectionList
