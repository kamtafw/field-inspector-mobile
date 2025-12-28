import { useState } from "react"
import { View, Text, TouchableOpacity, ActivityIndicator, Platform } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import clsx from "clsx"
import { useAuth } from "@/src/hooks/useAuth"
import InspectionList from "./components/InspectionList"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import type { MainStackParamList } from "@/src/navigation/types"
import { Feather } from "@expo/vector-icons"

type HomeScreenNavigationProp = NativeStackNavigationProp<MainStackParamList, "Home">

export default function HomeScreen() {
	const [isLoading, setIsLoading] = useState(false)
	const { logout } = useAuth()
	const navigation = useNavigation<HomeScreenNavigationProp>()
	const inspections = [1, 2, 3]

	const handleLogout = async () => {
		setIsLoading(true)
		try {
			await logout()
		} catch (err: any) {
			console.error("Logout failed:", err)
		} finally {
			setIsLoading(false)
		}
	}

	const handleCreateNew = async () => {
		navigation.navigate("CreateInspection")
	}

	return (
		<SafeAreaView className="flex-1 bg-background">
			<View className="bg-white p-5 pt-14 border-b border-[#e0e0e0]">
				<Text className="text-3xl text-[#1a1a1a] font-bold">Inspections</Text>
				<Text className="text-sm text-[#666] mt-1">
					{inspections.length} {inspections.length === 1 ? "Inspection" : "Inspections"}
				</Text>
			</View>

			{/* Inspection List */}
			<InspectionList />

			{/* Add Inspection Button */}
			<TouchableOpacity
				className={clsx(
					"absolute z-50 right-8 p-4 rounded-full shadow-lg bg-[#007AFF]",
					Platform.OS === "android" ? "bottom-16" : "bottom-20"
				)}
				style={{ elevation: 6 }}
				onPress={handleCreateNew}
			>
				<Feather name="plus" color="#FFF" size={20} />
			</TouchableOpacity>

			{/* Logout Button */}
			<TouchableOpacity
				className={clsx("bg-[#c42] m-6 p-4 rounded-lg items-center", isLoading && "opacity-60")}
				onPress={handleLogout}
				disabled={isLoading}
			>
				{isLoading ? (
					<ActivityIndicator color="#fff" />
				) : (
					<Text className="text-white text-base font-semibold">Log Out</Text>
				)}
			</TouchableOpacity>
		</SafeAreaView>
	)
}
