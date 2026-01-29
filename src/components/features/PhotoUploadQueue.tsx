import { useState, useEffect } from "react"
import { View, Text, TouchableOpacity } from "react-native"
import { Q } from "@nozbe/watermelondb"
import PhotoRepository from "@/src/database/repositories/PhotoRepository"
import PhotoUploadService from "@/src/services/photo/PhotoUploadService"
import Photo from "@/src/database/models/Photo"

export default function PhotoUploadQueue() {
	const [stats, setStats] = useState({ pending: 0, uploading: 0, failed: 0 })
	const [failedPhotos, setFailedPhotos] = useState<Photo[]>([])

	useEffect(() => {
		const loadStats = async () => {
			const uploadStats = await PhotoRepository.getUploadStats()
			setStats(uploadStats)

			if (uploadStats.failed > 0) {
				const failed = await PhotoRepository.collection
					.query(Q.where("upload_status", "failed"))
					.fetch()
				setFailedPhotos(failed)
			}
		}

		loadStats()
		const interval = setInterval(loadStats, 2000)
		return () => clearInterval(interval)
	}, [])

	if (stats.pending === 0 && stats.failed === 0) return null

	return (
		<View className="bg-blue-50 p-3 m-4 rounded-lg">
			<View className="flex-row justify-between items-center">
				<View>
					<Text className="text-sm font-semibold text-blue-900">📸 Photo Uploads</Text>
					{stats.uploading > 0 && (
						<Text className="text-xs text-blue-700">
							Uploading {stats.uploading} photo{stats.uploading > 1 ? "s" : ""}...
						</Text>
					)}
					{stats.pending > 0 && (
						<Text className="text-xs text-blue-700">{stats.pending} pending</Text>
					)}
					{stats.failed > 0 && (
						<Text className="text-xs text-red-600">⚠️ {stats.failed} failed</Text>
					)}
				</View>

				{stats.failed > 0 && (
					<TouchableOpacity
						className="bg-blue-600 px-3 py-2 rounded"
						onPress={() => PhotoUploadService.processQueue()}
					>
						<Text className="text-white text-xs font-semibold">Retry All</Text>
					</TouchableOpacity>
				)}
			</View>
		</View>
	)
}
