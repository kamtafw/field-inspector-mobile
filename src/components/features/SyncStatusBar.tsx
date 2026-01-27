import { useEffect, useState } from "react"
import { ActivityIndicator, Text, View } from "react-native"
import { Q } from "@nozbe/watermelondb"
import SyncEngine, { SyncStatus } from "@/src/services/sync/SyncEngine"
import SyncRepository from "@/src/database/repositories/SyncRepository"
import InspectionRepository from "@/src/database/repositories/InspectionRepository"

interface SyncStats {
	pending: number
	failed: number
	syncing: boolean
}

export default function SyncStatusBar() {
	const [status, setStatus] = useState<SyncStatus>("idle")
	const [stats, setStats] = useState<SyncStats>({ pending: 0, failed: 0, syncing: false })

	useEffect(() => {
		const handleSyncChange = (newStatus: SyncStatus) => {
			setStatus(newStatus)
		}

		SyncEngine.addListener(handleSyncChange)

		// poll database for actual stats every 2s
		const checkStats = async () => {
			try {
				const unsynced = (await InspectionRepository.getUnsynced()).length
				const failed = await SyncRepository.collection
					.query(Q.and(Q.where("status", "failed"), Q.where("retry_count", Q.lt(5))))
					.fetchCount()

				setStats({
					pending: unsynced,
					failed,
					syncing: status === "syncing",
				})
			} catch (err) {
				console.error("Error checking sync stats:", err)
			}
		}

		checkStats()

		const interval = setInterval(checkStats, 2000)

		return () => {
			SyncEngine.removeListener(handleSyncChange)
			clearInterval(interval)
		}
	}, [status])

	if (stats.pending === 0 && stats.failed === 0 && !stats.syncing) {
		return (
			<View className="bg-[#d4edda] py-2 px-3 rounded-xl">
				<Text className="text-[#155724] text-xs font-semibold">✓ All synced</Text>
			</View>
		)
	}

	if (stats.syncing || status === "syncing") {
		return (
			<View className="flex-row items-center bg-[#e3f2fd] py-2 px-3 rounded-xl">
				<ActivityIndicator size="small" color="#007AFF" />
				<Text className="text-[#0277bd] text-xs font-semibold ml-2">
					Syncing...({stats.pending} in progress)
				</Text>
			</View>
		)
	}

	if (stats.failed > 0) {
		return (
			<View className="bg-[#f8d7da] py-2 px-3 rounded-xl">
				<Text className="text-[#721c24] text-xs font-semibold">⚠️ {stats.failed} failed</Text>
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
