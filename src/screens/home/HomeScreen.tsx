import { useState } from "react"
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import clsx from "clsx"
import { useAuth } from "@/src/hooks/useAuth"

export default function HomeScreen() {
	const [isLoading, setIsLoading] = useState(false)
	const { logout } = useAuth()

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

	return (
		<SafeAreaView className="flex-1 bg-background">
			<View className="bg-white p-5 pt-14 border-b border-[#e0e0e0]">
				<Text className="text-3xl text-[#1a1a1a] font-bold">Inspections</Text>
				<Text className="text-sm text-[#666] mt-1">No inspections available.</Text>
			</View>

			{/* Content Area */}
			<View className="flex-1 justify-center px-6">
				<Text className="text-base text-[#666] text-center mb-5">
					You have no inspections at the moment. Please check back later or refresh to see if any
					new inspections are available.
				</Text>

				{/* Logout Button */}
				<TouchableOpacity
					className={clsx("bg-[#c42] p-4 rounded-lg items-center mt-2", isLoading && "opacity-60")}
					onPress={handleLogout}
					disabled={isLoading}
				>
					{isLoading ? (
						<ActivityIndicator color="#fff" />
					) : (
						<Text className="text-white text-base font-semibold">Log Out</Text>
					)}
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	)
}
