// src/components/debug/SyncDebugPanel.tsx
// Only show in development mode

import React, { useEffect, useState } from "react"
import { View, Text, TouchableOpacity } from "react-native"
import database from "@/src/database"
import NetworkMonitor from "@/src/services/network/NetworkMonitor"
import AutoSyncService from "@/src/services/sync/AutoSyncService"

export default function SyncDebugPanel() {
	const [stats, setStats] = useState({
		unsynced: 0,
		pending: 0,
		networkStatus: "unknown",
		lastCheck: "never",
	})

	const refresh = async () => {
		const inspections = database.get("inspections")
		const syncOps = database.get("sync_operations")

		const allInspections = await inspections.query().fetch()
		const unsynced = allInspections.filter(
			(i: any) => !i.isSynced && i.status === "submitted",
		).length

		const allOps = await syncOps.query().fetch()
		const pending = allOps.filter(
			(op: any) => op.status === "pending" || op.status === "failed",
		).length

		setStats({
			unsynced,
			pending,
			networkStatus: NetworkMonitor.getStatus(),
			lastCheck: new Date().toLocaleTimeString(),
		})
	}

	useEffect(() => {
		refresh()
		const interval = setInterval(refresh, 2000)
		return () => clearInterval(interval)
	}, [])

	// Only show in dev mode
	if (!__DEV__) return null

	return (
		<View className="absolute bottom-20 left-4 right-4 bg-yellow-300 rounded-lg p-3 z-50">
			<Text className="text-white font-bold mb-2">🔧 Sync Debug Panel</Text>

			<View className="flex-row justify-between mb-1">
				<Text className="text-white text-xs">Network:</Text>
				<Text
					className={`text-xs font-bold ${
						stats.networkStatus === "online" ? "text-green-400" : "text-red-400"
					}`}
				>
					{stats.networkStatus.toUpperCase()}
				</Text>
			</View>

			<View className="flex-row justify-between mb-1">
				<Text className="text-white text-xs">Unsynced Inspections:</Text>
				<Text className="text-yellow-400 text-xs font-bold">{stats.unsynced}</Text>
			</View>

			<View className="flex-row justify-between mb-1">
				<Text className="text-white text-xs">Pending Sync Ops:</Text>
				<Text className="text-yellow-400 text-xs font-bold">{stats.pending}</Text>
			</View>

			<View className="flex-row justify-between mb-3">
				<Text className="text-white text-xs">Last Check:</Text>
				<Text className="text-gray-400 text-xs">{stats.lastCheck}</Text>
			</View>

			<View className="flex-row gap-2">
				<TouchableOpacity
					className="flex-1 bg-blue-500 p-2 rounded"
					onPress={() => {
						console.log("🔄 Manual sync triggered from debug panel")
						AutoSyncService.syncNow()
					}}
				>
					<Text className="text-white text-xs text-center font-bold">Sync Now</Text>
				</TouchableOpacity>

				<TouchableOpacity className="flex-1 bg-gray-600 p-2 rounded" onPress={refresh}>
					<Text className="text-white text-xs text-center font-bold">Refresh</Text>
				</TouchableOpacity>
			</View>
		</View>
	)
}
