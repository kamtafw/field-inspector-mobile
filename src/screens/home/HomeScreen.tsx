import { useState } from "react"
import {
	View,
	Text,
	TouchableOpacity,
	ActivityIndicator,
	Platform,
	FlatList,
	RefreshControl,
} from "react-native"
import clsx from "clsx"
import { Feather } from "@expo/vector-icons"
import { useNavigation } from "@react-navigation/native"
import { SafeAreaView } from "react-native-safe-area-context"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import InspectionCard from "./components/InspectionCard"
import { useAuth } from "@/src/providers/AuthProvider"
import useInspections from "@/src/hooks/useInspections"
import { MainStackParamList } from "@/src/navigation/types"
import EmptyState, { NoInspectionsEmpty } from "@/src/components/ui/EmptyState"
import { InspectionListSkeleton } from "@/src/components/ui/SkeletonLoader"
import SyncStatusBar from "@/src/components/features/SyncStatusBar"
import NetworkStatusIndicator from "@/src/components/features/NetworkStatusIndicator"
import AutoSyncService from "@/src/services/sync/AutoSyncService"
import SyncDebugPanel from "@/src/components/debug/SyncDebugPanel"

type HomeScreenNavigationProp = NativeStackNavigationProp<MainStackParamList, "Home">

export default function HomeScreen() {
	const { logout } = useAuth()
	const navigation = useNavigation<HomeScreenNavigationProp>()

	const [isLoggingOut, setIsLoggingOut] = useState(false)
	const [refreshing, setRefreshing] = useState(false)

	const { inspections, isLoading, error } = useInspections()

	const onRefresh = async () => {
		setRefreshing(true)
		try {
			AutoSyncService.syncNow()
		} catch (err) {
			console.error("Refresh sync failed:", err)
		} finally {
			setRefreshing(false)
		}
	}

	const handleLogout = async () => {
		setIsLoggingOut(true)
		try {
			await logout()
		} catch (err) {
			console.error("Logout failed:", err)
		} finally {
			setIsLoggingOut(false)
		}
	}

	const handleCreateNew = async () => {
		navigation.navigate("CreateInspection")
	}

	if (isLoading && !inspections) {
		return (
			<SafeAreaView className="flex-1 bg-background">
				<Header subtext="Loading Inspections..." view="loading" />

				<InspectionListSkeleton />
			</SafeAreaView>
		)
	}

	if (error) {
		return (
			<SafeAreaView className="flex-1 bg-background">
				<Header subtext="Error Loading Inspections" view="error" />

				<EmptyState
					icon="⚠️"
					title="Error Loading Inspections"
					message={error}
					actionLabel="Retry"
					onAction={onRefresh}
				/>
			</SafeAreaView>
		)
	}

	if (!inspections || inspections.length === 0) {
		return (
			<SafeAreaView className="flex-1 bg-background">
				<Header subtext="No Inspections" view="empty" />

				<NoInspectionsEmpty onCreate={handleCreateNew} />
			</SafeAreaView>
		)
	}

	return (
		<SafeAreaView className="flex-1 bg-background">
			{/* Header w/ sync status */}
			<Header
				subtext={`${inspections.length} ${inspections.length === 1 ? "Inspection" : "Inspections"}`}
				view="default"
			/>

			{/* Inspection List */}
			<FlatList
				data={inspections}
				keyExtractor={(item) => item.id}
				renderItem={({ item }) => <InspectionCard inspection={item} />}
				contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
			/>

			{/* FAB - Add Inspection Button */}
			<TouchableOpacity
				className={clsx(
					"absolute z-50 right-8 p-4 rounded-full shadow-lg bg-[#007AFF]",
					Platform.OS === "android" ? "bottom-16" : "bottom-20",
				)}
				style={{ elevation: 6 }}
				onPress={handleCreateNew}
			>
				<Feather name="plus" color="#FFF" size={20} />
			</TouchableOpacity>

			{/* Logout Button */}
			<TouchableOpacity
				className={clsx("bg-[#c42] m-6 p-4 rounded-lg items-center", isLoggingOut && "opacity-60")}
				onPress={handleLogout}
				disabled={isLoggingOut}
			>
				{isLoggingOut ? (
					<ActivityIndicator color="#fff" />
				) : (
					<Text className="text-white text-base font-semibold">Log Out</Text>
				)}
			</TouchableOpacity>
		</SafeAreaView>
	)
}

interface HeaderProps {
	subtext: string
	view: "loading" | "error" | "empty" | "default"
}
function Header({ subtext, view = "loading" }: HeaderProps) {
	return (
		<>
			<NetworkStatusIndicator />
			<View className="bg-white p-5 pt-14 border-b border-[#e0e0e0]">
				<View>
					<Text className="text-3xl text-[#1a1a1a] font-bold">Inspections</Text>
					<Text className="text-sm text-[#666] mt-1">{subtext}</Text>
				</View>
				{view === "default" && <SyncStatusBar />}
			</View>
		</>
	)
}
