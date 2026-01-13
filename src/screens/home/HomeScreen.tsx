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
import { withObservables } from "@nozbe/watermelondb/react"
import { SafeAreaView } from "react-native-safe-area-context"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import SyncStatusBar from "@/src/components/features/SyncStatusBar"
import { MainStackParamList } from "@/src/navigation/types"
import InspectionCard from "./components/InspectionCard"
import Inspection from "@/src/database/models/Inspection"
import SyncEngine from "@/src/services/sync/SyncEngine"
import InspectionRepository from "@/src/database/repositories/InspectionRepository"
import { useAuth } from "@/src/providers/AuthProvider"
import NetworkStatusIndicator from "@/src/components/features/NetworkStatusIndicator"

/*
TODO: HomeScreen must:
- render cleanly when zero inspections exist
- show empty state (even text-only)
** no spinners forever; no crashes

TODO: sort inspections by:
- updated_at DESC or created_at DESC
** prevents list reordering on reload & reduces UI "jumpiness"
*/

type HomeScreenNavigationProp = NativeStackNavigationProp<MainStackParamList, "Home">

function HomeScreenComponent({ inspections }: { inspections: Inspection[] }) {
	const { logout } = useAuth()
	const navigation = useNavigation<HomeScreenNavigationProp>()
	const [refreshing, setRefreshing] = useState(false)
	const [isLoading, setIsLoading] = useState(false)
	const [isSyncing, setIsSyncing] = useState(false)

	const onRefresh = async () => {
		setRefreshing(true)
		// TODO: trigger sync
		setTimeout(() => setRefreshing(false), 2000)
	}

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

	const handleSync = async () => {
		setIsSyncing(true)
		try {
			await SyncEngine.initialize()
			// await SyncEngine.process()
		} catch (err: any) {
			console.error("Sync failed:", err)
		} finally {
			setIsSyncing(false)
		}
	}

	const handleCreateNew = async () => {
		navigation.navigate("CreateInspection")
	}

	const renderEmpty = () => (
		<View className="items-center justify-center py-20">
			<Text className="text-[64px] mb-4">📋</Text>
			<Text className="text-xl text-[#1a1a1a] font-semibold mb-2">No inspections yet</Text>
			<Text className="text-sm text-[#666] text-center px-10">
				Tap the + button to create your first inspection
			</Text>
		</View>
	)

	if (inspections === null) {
		return (
			<View className="flex-1 justify-center items-center bg-background">
				<ActivityIndicator size="large" color="#007AFF" />
				<Text className="mt-3 text-[#666] text-base">Loading inspections...</Text>
			</View>
		)
	}

	const isEmpty = inspections.length === 0

	return (
		<SafeAreaView className="flex-1 bg-background">
			<NetworkStatusIndicator />

			<View className="bg-white p-5 pt-14 border-b border-[#e0e0e0]">
				<View>
					<Text className="text-3xl text-[#1a1a1a] font-bold">Inspections</Text>
					<Text className="text-sm text-[#666] mt-1">
						{inspections.length} {inspections.length === 1 ? "Inspection" : "Inspections"}
					</Text>
				</View>
				<SyncStatusBar />
			</View>

			{/* Inspection List */}
			<FlatList
				data={inspections}
				keyExtractor={(item) => item.id}
				renderItem={({ item }) => <InspectionCard inspection={item} />}
				contentContainerStyle={{ padding: 16, paddingBottom: 80, flexGrow: isEmpty ? 1 : 0 }}
				ListEmptyComponent={renderEmpty}
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
			/>

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

			{/* Sync Button */}
			<TouchableOpacity
				className={clsx("bg-green-600 m-6 p-4 rounded-lg items-center", isSyncing && "opacity-60")}
				onPress={handleSync}
				disabled={isSyncing}
			>
				{isSyncing ? (
					<ActivityIndicator color="#fff" />
				) : (
					<Text className="text-white text-base font-semibold">Sync Operations</Text>
				)}
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

const enhance = withObservables([], () => {
	const inspections$ = InspectionRepository.collection.query().observe()

	return { inspections: inspections$ }
})

const HomeScreen = enhance(HomeScreenComponent)
export default HomeScreen
