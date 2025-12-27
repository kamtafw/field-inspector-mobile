import { FlatList, Text, View } from "react-native"
import InspectionCard from "./InspectionCard"

export default function InspectionList() {
	return (
		<View className="flex-auto">
			{/* Headers */}
			<View className="flex-row p-3 justify-between">
				<Text>Facility</Text>
				<Text>Status</Text>
			</View>

			{/* Inspections */}
			<FlatList
				data={[1, 2, 3, 4, 5]}
				contentContainerStyle={{ gap: 5 }}
				renderItem={() => <InspectionCard />}
			/>
		</View>
	)
}
