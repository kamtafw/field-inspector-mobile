import { useEffect, useState } from "react"
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useAuth } from "@/src/providers/AuthProvider"
import AuthAPI from "@/src/services/api/auth.api"
import InspectionRepository from "@/src/database/repositories/InspectionRepository"
import PhotoRepository from "@/src/database/repositories/PhotoRepository"
import { getAvatarColor, getInitials } from "@/src/utils/avatar"

interface UserProfile {
	id: string
	email: string
	name: string
	role: string
}

export default function ProfileScreen() {
	const { logout, userName, userEmail, userRole } = useAuth()

	const [firstName, lastName] = userName?.split(" ") || []
	const initials = getInitials(firstName, lastName)
	const avatarColor = getAvatarColor(userName || userEmail || "")

	const [stats, setStats] = useState({
		totalInspections: 0,
		syncedInspections: 0,
		pendingInspections: 0,
		totalPhotos: 0,
		uploadedPhotos: 0,
	})
	const [isLoading, setIsLoading] = useState(true)
	const [isLoggingOut, setIsLoggingOut] = useState(false)

	useEffect(() => {
		loadStats()
	}, [])

	const loadStats = async () => {
		try {
			setIsLoading(true)

			const inspections = await InspectionRepository.collection.query().fetch()
			const photos = await PhotoRepository.collection.query().fetch()

			setStats({
				totalInspections: inspections.length,
				syncedInspections: inspections.filter((i: any) => i.isSynced).length,
				pendingInspections: inspections.filter((i: any) => !i.isSynced && i.status === "submitted")
					.length,
				totalPhotos: photos.length,
				uploadedPhotos: photos.filter((p: any) => p.uploadStatus === "completed").length,
			})
		} catch (err) {
			console.error("Error loading stats:", err)
		} finally {
			setIsLoading(false)
		}
	}

	const handleLogout = () => {
		Alert.alert("Log Out", "Are you sure you want to log out?", [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Log Out",
				style: "destructive",
				onPress: async () => {
					setIsLoggingOut(true)
					try {
						await logout(true)
					} catch (err) {
						console.error("Logout failed:", err)
					} finally {
						setIsLoggingOut(false)
					}
				},
			},
		])
	}

	if (isLoading) {
		return (
			<SafeAreaView className="flex-1 bg-background">
				<View className="flex-1 justify-center items-center">
					<ActivityIndicator size="large" color="#007AFF" />
				</View>
			</SafeAreaView>
		)
	}

	return (
		<SafeAreaView className="flex-1 bg-background">
			<ScrollView className="flex-1" contentContainerClassName="p-6">
				{/* Header */}
				<View className="items-center mb-8 mt-4">
					<View
						className="w-24 h-24 rounded-full items-center justify-center"
						style={{ backgroundColor: avatarColor }}
					>
						<Text className="text-white text-4xl font-bold">{initials}</Text>
					</View>
					<Text className="text-2xl font-bold text-[#1a1a1a] mt-4">{userName}</Text>
					<Text className="text-base text-[#666]">{userEmail}</Text>
					<View className="bg-[#e3f2fd] px-3 py-1 rounded-full mt-2">
						<Text className="text-xs text-[#0277bd] font-semibold uppercase">{userRole}</Text>
					</View>
				</View>

				{/* Stats */}
				<View className="bg-white rounded-xl p-4 mb-4">
					<Text className="text-lg font-semibold text-[#1a1a1a] mb-4">Statistics</Text>

					<View className="flex-row justify-between mb-3">
						<Text className="text-[#666]">Total Inspections</Text>
						<Text className="text-[#1a1a1a] font-semibold">{stats.totalInspections}</Text>
					</View>

					<View className="flex-row justify-between mb-3">
						<Text className="text-[#666]">Synced Inspections</Text>
						<Text className="text-[#34c759] font-semibold">{stats.syncedInspections}</Text>
					</View>

					<View className="flex-row justify-between mb-3">
						<Text className="text-[#666]">Pending Sync</Text>
						<Text className="text-[#ff9500] font-semibold">{stats.pendingInspections}</Text>
					</View>

					<View className="border-t border-[#f0f0f0] my-3" />

					<View className="flex-row justify-between mb-3">
						<Text className="text-[#666]">Total Photos</Text>
						<Text className="text-[#1a1a1a] font-semibold">{stats.totalPhotos}</Text>
					</View>

					<View className="flex-row justify-between">
						<Text className="text-[#666]">Uploaded Photos</Text>
						<Text className="text-[#34c759] font-semibold">{stats.uploadedPhotos}</Text>
					</View>
				</View>

				{/* Account Section */}
				<View className="bg-white rounded-xl p-4 mb-4">
					<Text className="text-lg font-semibold text-[#1a1a1a] mb-4">Account</Text>

					<TouchableOpacity className="flex-row justify-between items-center py-3 border-b border-[#f0f0f0]">
						<Text className="text-[#1a1a1a]">Edit Profile</Text>
						<Text className="text-[#c7c7c7]">›</Text>
					</TouchableOpacity>

					<TouchableOpacity className="flex-row justify-between items-center py-3 border-b border-[#f0f0f0]">
						<Text className="text-[#1a1a1a]">Change Password</Text>
						<Text className="text-[#c7c7c7]">›</Text>
					</TouchableOpacity>

					<TouchableOpacity className="flex-row justify-between items-center py-3">
						<Text className="text-[#1a1a1a]">Notifications</Text>
						<Text className="text-[#c7c7c7]">›</Text>
					</TouchableOpacity>
				</View>

				{/* App Info */}
				<View className="bg-white rounded-xl p-4 mb-6">
					<Text className="text-lg font-semibold text-[#1a1a1a] mb-4">About</Text>

					<View className="flex-row justify-between mb-3">
						<Text className="text-[#666]">App Version</Text>
						<Text className="text-[#1a1a1a]">1.0.0</Text>
					</View>

					<TouchableOpacity className="flex-row justify-between items-center py-3 border-t border-[#f0f0f0]">
						<Text className="text-[#1a1a1a]">Privacy Policy</Text>
						<Text className="text-[#c7c7c7]">›</Text>
					</TouchableOpacity>

					<TouchableOpacity className="flex-row justify-between items-center py-3 border-t border-[#f0f0f0]">
						<Text className="text-[#1a1a1a]">Terms of Service</Text>
						<Text className="text-[#c7c7c7]">›</Text>
					</TouchableOpacity>

					<TouchableOpacity className="flex-row justify-between items-center py-3 border-t border-[#f0f0f0]">
						<Text className="text-[#1a1a1a]">Help & Support</Text>
						<Text className="text-[#c7c7c7]">›</Text>
					</TouchableOpacity>
				</View>

				{/* Logout Button */}
				<TouchableOpacity
					className={`bg-[#ff3b30] p-4 rounded-lg items-center mb-6 ${
						isLoggingOut && "opacity-60"
					}`}
					onPress={handleLogout}
					disabled={isLoggingOut}
				>
					{isLoggingOut ? (
						<ActivityIndicator color="#fff" />
					) : (
						<Text className="text-white text-base font-semibold">Log Out</Text>
					)}
				</TouchableOpacity>

				{/* Footer */}
				<Text className="text-center text-xs text-[#999] mb-4">Field Inspector © 2025</Text>
			</ScrollView>
		</SafeAreaView>
	)
}
