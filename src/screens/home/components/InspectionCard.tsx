import { Text, View } from "react-native"
import { InspectionProps } from "./InspectionList"

export default function InspectionCard({ inspection }: { inspection: InspectionProps }) {
	return (
		<View className="flex-row bg-white p-2 justify-between rounded-md">
			<Text className="text-base font-bold">{inspection.facilityName}</Text>
			<Text className="font-extralight">{inspection.status}</Text>
		</View>
	)
}
