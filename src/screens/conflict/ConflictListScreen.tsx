import Conflict from "@/src/database/models/Conflict"
import ConflictRepository from "@/src/database/repositories/ConflictRepository"
import InspectionRepository from "@/src/database/repositories/InspectionRepository"
import { MainStackParamList } from "@/src/navigation/types"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { useEffect, useState } from "react"
import {
	ActivityIndicator,
	FlatList,
	RefreshControl,
	Text,
	TouchableOpacity,
	View,
} from "react-native"

type ConflictListScreenNavigationProp = NativeStackNavigationProp<
	MainStackParamList,
	"ConflictList"
>

export default function ConflictListScreen() {
	const navigation = useNavigation<ConflictListScreenNavigationProp>()

	const [conflicts, setConflicts] = useState<Conflict[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [refreshing, setRefreshing] = useState(false)

	useEffect(() => {
		loadConflicts()
	}, [])

	const loadConflicts = async () => {
		try {
			setIsLoading(true)
			const unresolvedConflicts = await ConflictRepository.getUnresolved()
			setConflicts(unresolvedConflicts)
		} catch (err) {
			console.error("Error loading conflicts:", err)
		} finally {
			setIsLoading(false)
		}
	}

	const onRefresh = async () => {
		setRefreshing(true)
		await loadConflicts()
		setRefreshing(false)
	}

	const handleConflictPress = async (conflict: Conflict) => {
		const inspection = await InspectionRepository.getById(conflict.inspectionId)
		navigation.navigate("ConflictResolution", { conflict, inspection } as never)
	}

	const renderConflict = ({ item }: { item: Conflict }) => {
		const conflictCount = item.conflictFields.length
		const facilityName = item.clientData.facilityName || item.serverData.facilityName

		return (
			<TouchableOpacity
				onPress={() => handleConflictPress(item)}
				className="bg-white rounded-xl p-4 mb-3 border-2 border-[#ff3b30] shadow-sm"
			>
				<View className="flex-row justify-between items-center mb-3">
					<View className="bg-[#ff3b30] px-[10px] py-1 rounded-xl">
						<Text className="text-xs text-white font-bold">⚠️ CONFLICT</Text>
					</View>
					<Text className="text-xs text-[#999]">
						{new Date(item.createdTs).toLocaleDateString()}
					</Text>
				</View>

				<Text className="text-lg text-[#1a1a1a] font-semibold mb-3">{facilityName}</Text>

				<View className="flex-row items-center justify-between mb-3 px-3 py-2 bg-[#f9f9f9] rounded-lg">
					<View className="flex-1 items-center">
						<Text className="text-xs text-[#666] mb-1">Your version</Text>
						<Text className="text-base text-[#ff3b30] font-bold">v{item.clientVersion}</Text>
					</View>
					<Text className="text-sm text-[#999] font-semibold mx-2">vs</Text>
					<View className="flex-1 items-center">
						<Text className="text-xs text-[#666] mb-1">Server version</Text>
						<Text className="text-base text-[#ff3b30] font-bold">v{item.serverVersion}</Text>
					</View>
				</View>

				<Text className="text-sm text-[#666] mb-3">
					{conflictCount} field{conflictCount !== 1 ? "s" : ""} in conflict
				</Text>

				<View className="border-t border-t-[#f0f0f0] pt-3">
					<Text className="text-sm text-[#007AFF] text-center font-semibold">Tap to resolve →</Text>
				</View>
			</TouchableOpacity>
		)
	}

	if (isLoading) {
		return (
			<View className="flex-1 justify-center items-center bg-background">
				<ActivityIndicator size="large" color="#ff3b30" />
				<Text className="mt-3 text-base text-[#666]">Loading conflicts...</Text>
			</View>
		)
	}

	if (conflicts.length === 0) {
		return (
			<View className="flex-1 justify-center items-center bg-background p-10">
				<Text className="text-6xl mb-4">✅</Text>
				<Text className="text-xl text-[#1a1a1a] font-semibold mb-2">No conflicts</Text>
				<Text className="text-sm text-[#666] text-center">All your inspections are in sync</Text>
			</View>
		)
	}

	return (
		<View className="flex-1 bg-background">
			<View className="bg-white p-5 pt-14 border-b border-b-[#e0e0e0]">
				<Text className="text-3xl text-[#1a1a1a] font-bold">Conflicts to Resolve</Text>
				<Text className="text-sm text-[#ff3b30] font-medium mt-1">
					{conflicts.length} conflict{conflicts.length !== 1 ? "s" : ""} require your attention
				</Text>
			</View>

			<FlatList
				data={conflicts}
				renderItem={renderConflict}
				keyExtractor={(item) => item.id}
				contentContainerClassName="p-4"
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
			/>
		</View>
	)
}
