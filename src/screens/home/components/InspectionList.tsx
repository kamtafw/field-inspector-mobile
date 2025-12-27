import { FlatList, Text, View } from "react-native"
import InspectionCard from "./InspectionCard"
import { useEffect, useState } from "react"
import database from "@/src/database"
import Inspection from "@/src/database/models/Inspection"

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

export default function InspectionList() {
	const [inspections, setInspections] = useState<InspectionProps[]>([])

	useEffect(() => {
		const fetchInspections = async () => {
			const inspectionsCollection = database.get<Inspection>("inspections")
			const models = await inspectionsCollection.query().fetch()
			setInspections(models.map(inspectionToProps))
		}

		fetchInspections()
	}, [])

	return (
		<View className="flex-auto">
			{/* Headers */}
			<View className="flex-row p-3 justify-between">
				<Text>Facility</Text>
				<Text>Status</Text>
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
