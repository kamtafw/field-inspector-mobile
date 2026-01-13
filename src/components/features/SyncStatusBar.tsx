import { useEffect, useState } from "react"
import { ActivityIndicator, Text, View } from "react-native"
import SyncEngine, { SyncStats, SyncStatus } from "@/src/services/sync/SyncEngine"

export default function SyncStatusBar() {
	const [status, setStatus] = useState<SyncStatus>(SyncEngine.getStatus())
	const [stats, setStats] = useState<SyncStats | null>(null)

	useEffect(() => {
		const handleSyncChange = (newStatus: SyncStatus, newStats?: SyncStats) => {
			setStatus(newStatus)
			if (newStats) {
				setStats(newStats)
			}
		}

		SyncEngine.addListener(handleSyncChange)

		// load initial stats
		SyncEngine.getStats().then(setStats)

		return () => {
			SyncEngine.removeListener(handleSyncChange)
		}
	}, [])

	if (!stats || (stats.pending === 0 && stats.failed === 0 && status === "idle")) {
		return (
			<View className="bg-[#d4edda] py-2 px-3 rounded-xl">
				<Text className="text-[#155724] text-xs font-semibold">✓ All synced</Text>
			</View>
		)
	}

	if (status === "syncing") {
		return (
			<View className="flex-row items-center bg-[#e3f2fd] py-2 px-3 rounded-xl">
				<ActivityIndicator size="small" color="#007AFF" />
				<Text className="text-[#0277bd] text-xs font-semibold ml-2">
					Syncing...({stats.inProgress} in progress)
				</Text>
			</View>
		)
	}

	if (stats.failed > 0) {
		return (
			<View className="bg-[#f8d7da] py-2 px-3 rounded-xl">
				<Text className="text-[#721c24] text-xs font-semibold">
					⚠️ {stats.failed} failed - Will retry
				</Text>
			</View>
		)
	}

	if (stats.pending > 0) {
		return (
			<View className="flex-row items-center bg-[#fff3cd] py-2 px-3 rounded-xl">
				<View className="w-1 h-1 rounded-sm bg-[#856404] mr-1" />
				<Text className="text-[#856404] text-xs font-semibold">{stats.pending} pending</Text>
			</View>
		)
	}

	return null
}
