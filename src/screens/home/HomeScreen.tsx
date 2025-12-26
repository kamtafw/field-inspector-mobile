import { useNavigation } from "@react-navigation/native"
import { useState } from "react"
import { View, Text } from "react-native"

export default function HomeScreen() {
	// const navigation = useNavigation()
	const [refreshing, setRefreshing] = useState(false)

	return (
		<View className="flex-1 bg-background">
			<View className="bg-white p-5 pt-14 border-b border-[#e0e0e0]">
				<Text className="text-3xl text-[#1a1a1a] font-bold">Inspections</Text>
				<Text className="text-sm text-[#666] mt-1">No inspections available.</Text>
			</View>
		</View>
	)
}
