import { useEffect, useState } from "react"
import { ActivityIndicator, Text, View } from "react-native"
import { Q } from "@nozbe/watermelondb"
import * as SecureStore from "expo-secure-store"
import SyncEngine, { SyncStatus } from "@/src/services/sync/SyncEngine"
import SyncRepository from "@/src/database/repositories/SyncRepository"
import InspectionRepository from "@/src/database/repositories/InspectionRepository"

interface SyncStats {
	pending: number
	failed: number
	syncing: boolean
	syncedCount: number
	syncFailedCount: number
	totalToSync: number
	lastSyncTs?: number
}

export default function SyncStatusBar() {
	const [status, setStatus] = useState<SyncStatus>("idle")
	const [stats, setStats] = useState<SyncStats>({
		pending: 0,
		failed: 0,
		syncing: false,
		syncedCount: 0,
		syncFailedCount: 0,
		totalToSync: 0,
	})

	useEffect(() => {
		const handleSyncChange = (newStatus: SyncStatus) => {
			setStatus(newStatus)
		}

		SyncEngine.addListener(handleSyncChange)

		const checkStats = async () => {
			const unsynced = (await InspectionRepository.getUnsynced()).length
			const syncFailed = (await InspectionRepository.getSyncFailed()).length
			const failed = await SyncRepository.collection
				.query(Q.and(Q.where("status", "failed"), Q.where("retry_count", Q.lt(5))))
				.fetchCount()
			const syncStats = await SyncEngine.getStats()

			const lastSynced = await SecureStore.getItemAsync("lastSyncTimestamp")

			setStats({
				pending: unsynced,
				syncFailedCount: syncFailed,
				failed,
				syncing: status === "syncing",
				syncedCount: syncStats.syncedCount || 0,
				totalToSync: syncStats.totalToSync || 0,
				lastSyncTs: lastSynced ? parseInt(lastSynced) : undefined,
			})
		}

		checkStats()

		// poll database for actual stats every 2s
		const interval = setInterval(checkStats, 2000)

		return () => {
			SyncEngine.removeListener(handleSyncChange)
			clearInterval(interval)
		}
	}, [status])

	const formatLastSync = (timestamp?: number) => {
		if (!timestamp) return "Never synced"

		const now = Date.now()
		const diff = now - timestamp
		const minutes = Math.floor(diff / 60000)

		if (minutes < 1) return "Just now"
		if (minutes < 60) return `${minutes}m ago`

		const hours = Math.floor(minutes / 60)
		if (hours < 24) return `${hours}h ago`

		return new Date(timestamp).toLocaleDateString()
	}

	if (stats.pending === 0 && stats.failed === 0 && stats.syncFailedCount === 0 && !stats.syncing) {
		return (
			<View className="flex-row items-center justify-between bg-[#d4edda] py-2 px-3 rounded-xl">
				<Text className="text-[#155724] text-xs font-semibold">✓ All synced</Text>

				{stats.lastSyncTs && (
					<Text className="text-xs text-gray-500 mt-1">
						Last synced: {formatLastSync(stats.lastSyncTs)}
					</Text>
				)}
			</View>
		)
	}

	if (stats.syncing || status === "syncing") {
		return (
			<View className="flex-row items-center bg-[#e3f2fd] py-2 px-3 rounded-xl">
				<ActivityIndicator size="small" color="#007AFF" />
				<Text className="text-[#0277bd] text-xs font-semibold ml-2">
					Syncing ({stats.syncedCount} of {stats.totalToSync})
				</Text>
			</View>
		)
	}

	if (stats.syncFailedCount > 0) {
		return (
			<View className="flex-row items-center justify-between bg-[#fff3cd] py-2 px-3 rounded-xl">
				<View className="flex-row items-center">
					<View className="w-1 h-1 rounded-sm bg-[#856404] mr-1" />
					<Text className="text-[#856404] text-xs font-semibold">
						{stats.syncFailedCount} inspections failed to sync
					</Text>
				</View>

				{stats.lastSyncTs && (
					<Text className="text-xs text-gray-500 mt-1">
						Last synced: {formatLastSync(stats.lastSyncTs)}
					</Text>
				)}
			</View>
		)
	}

	if (stats.failed > 0) {
		return (
			<View className="flex-row items-center justify-between bg-[#f8d7da] py-2 px-3 rounded-xl">
				<Text className="text-[#721c24] text-xs font-semibold">
					⚠️ {stats.failed} failed operations
				</Text>

				{stats.lastSyncTs && (
					<Text className="text-xs text-gray-500 mt-1">
						Last synced: {formatLastSync(stats.lastSyncTs)}
					</Text>
				)}
			</View>
		)
	}

	if (stats.pending > 0) {
		return (
			<View className="flex-row items-center justify-between bg-[#fff3cd] py-2 px-3 rounded-xl">
				<View className="flex-row items-center">
					<View className="w-1 h-1 rounded-sm bg-[#856404] mr-1" />
					<Text className="text-[#856404] text-xs font-semibold">{stats.pending} pending</Text>
				</View>

				{stats.lastSyncTs && (
					<Text className="text-xs text-gray-500 mt-1">
						Last synced: {formatLastSync(stats.lastSyncTs)}
					</Text>
				)}
			</View>
		)
	}

	return null
}
