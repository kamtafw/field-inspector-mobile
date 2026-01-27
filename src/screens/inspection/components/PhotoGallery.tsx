import Inspection from "@/src/database/models/Inspection"
import Photo from "@/src/database/models/Photo"
import InspectionRepository from "@/src/database/repositories/InspectionRepository"
import PhotoRepository from "@/src/database/repositories/PhotoRepository"
import PhotoService from "@/src/services/photo/PhotoService"
import PhotoUploadService from "@/src/services/photo/PhotoUploadService"
import { useEffect, useState } from "react"
import {
	ActivityIndicator,
	Alert,
	Dimensions,
	Image,
	ScrollView,
	Text,
	TouchableOpacity,
	View,
} from "react-native"

interface PhotoGalleryProps {
	inspectionId: string
	canEdit: boolean
}

const { width: SCREEN_WIDTH } = Dimensions.get("window")
const PHOTO_SIZE = (SCREEN_WIDTH - 48) / 3 // 3 columns with padding

export default function PhotoGallery({ inspectionId, canEdit }: PhotoGalleryProps) {
	const [inspection, setInspection] = useState<Inspection | null>(null)
	const [photos, setPhotos] = useState<Photo[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})

	useEffect(() => {
		loadInspectionAndPhotos()

		const handleProgress = ({ photoId, progress }: { photoId: string; progress: number }) => {
			setUploadProgress((prev) => ({ ...prev, [photoId]: progress }))
		}

		PhotoUploadService.addProgressListener(handleProgress)

		return () => {
			PhotoUploadService.removeProgressListener(handleProgress)
		}
	}, [inspectionId])

	const loadInspectionAndPhotos = async () => {
		try {
			setIsLoading(true)

			const inspectionData = await InspectionRepository.getById(inspectionId)
			setInspection(inspectionData)

			const photosData = await PhotoRepository.getByInspectionId(inspectionId)
			setPhotos(photosData)
		} catch (err) {
			console.error("Failed to load photos:", err)
		} finally {
			setIsLoading(false)
		}
	}

	const handleTakePhoto = async () => {
		try {
			const result = await PhotoService.takePhoto()
			if (!result) return

			await PhotoRepository.create({
				inspectionId,
				localUri: result.uri,
				fileSize: result.fileSize,
				width: result.width,
				height: result.height,
				mimeType: result.mimeType,
			})

			await loadInspectionAndPhotos()
		} catch (err: any) {
			console.error("Failed to take photo:", err)
			Alert.alert("Error", err.message || "Failed to take photo")
		}
	}

	const handlePickPhoto = async () => {
		try {
			const result = await PhotoService.pickPhoto()
			if (!result) return

			await PhotoRepository.create({
				inspectionId,
				localUri: result.uri,
				fileSize: result.fileSize,
				width: result.width,
				height: result.height,
				mimeType: result.mimeType,
			})

			await loadInspectionAndPhotos()
		} catch (err: any) {
			console.error("Failed to pick photo:", err)
			Alert.alert("Error", err.message || "Failed to pick photo")
		}
	}

	const handleRetryUpload = async (photoId: string) => {
		try {
			await PhotoUploadService.retryUpload(photoId)
		} catch (err: any) {
			Alert.alert("Error", "Failed to retry upload")
		}
	}

	const handleDeletePhoto = async (photoId: string) => {
		Alert.alert("Delete Photo", "Are you sure you want to delete this photo?", [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Delete",
				style: "destructive",
				onPress: async () => {
					try {
						await PhotoRepository.delete(photoId)
						await loadInspectionAndPhotos()
					} catch (err) {
						Alert.alert("Error", "Failed to delete photo")
					}
				},
			},
		])
	}

	const showPhotoOptions = () => {
		Alert.alert("Add Photo", "Choose a source", [
			{ text: "Cancel", style: "cancel" },
			{ text: "Take Photo", onPress: handleTakePhoto },
			{ text: "Choose from Gallery", onPress: handlePickPhoto },
		])
	}

	if (isLoading) {
		return (
			<View className="items-center py-8">
				<ActivityIndicator size="small" color="#007aff" />
			</View>
		)
	}

	return (
		<View className="bg-white rounded-xl p-4 mb-4">
			<View className="flex-row justify-between items-center mb-4">
				<Text className="text-lg text-[#1a1a1a] font-semibold">Photos</Text>
				{canEdit && (
					<TouchableOpacity
						className="bg-[#007aff] px-4 py-2 rounded-lg"
						onPress={showPhotoOptions}
					>
						<Text className="text-sm text-white font-semibold">+ Add Photo</Text>
					</TouchableOpacity>
				)}
			</View>

			{photos.length === 0 ? (
				<View className="items-center py-8 border-2 border-dashed border-[#e0e0e0] rounded-lg">
					<Text className="text-4xl mb-2">📸</Text>
					<Text className="text-sm text-[#999]">No photos yet</Text>
					{canEdit && (
						<TouchableOpacity className="mt-3" onPress={showPhotoOptions}>
							<Text className="text-sm text-[#007aff]">Tap to add photos</Text>
						</TouchableOpacity>
					)}
				</View>
			) : (
				<ScrollView showsHorizontalScrollIndicator={false}>
					<View className="flex-row gap-2">
						{photos.map((photo) => (
							<PhotoItem
								key={photo.id}
								photo={photo}
								progress={uploadProgress[photo.id]}
								onRetry={() => handleRetryUpload(photo.id)}
								onDelete={() => handleDeletePhoto(photo.id)}
								canEdit={canEdit}
							/>
						))}
					</View>
				</ScrollView>
			)}
		</View>
	)
}

interface PhotoItemProps {
	photo: Photo
	progress?: number
	onRetry: () => void
	onDelete: () => void
	canEdit: boolean
}

function PhotoItem({ photo, progress, onRetry, onDelete, canEdit }: PhotoItemProps) {
	const imageUri = photo.cloudinaryUrl || photo.localUri

	return (
		<View style={{ width: PHOTO_SIZE, height: PHOTO_SIZE }}>
			<Image
				source={{ uri: imageUri }}
				style={{ width: "100%", height: "100%", borderRadius: 8 }}
				resizeMode="cover"
			/>

			{/* Upload Status Overlay */}
			{photo.uploadStatus === "uploading" && (
				<View className="absolute inset-0 bg-black/50 rounded-lg items-center justify-center">
					<ActivityIndicator color="#fff" />
					{progress !== undefined && (
						<Text className="text-xs text-white mt-2">{Math.round(progress)}%</Text>
					)}
				</View>
			)}

			{photo.uploadStatus === "pending" && (
				<View className="absolute inset-0 bg-black/50 rounded-lg items-center justify-center">
					<Text className="text-xs text-white mt-2">Pending...</Text>
				</View>
			)}

			{photo.uploadStatus === "failed" && (
				<View className="absolute inset-0 bg-black/50 rounded-lg items-center justify-center">
					<Text className="text-xs text-white mb-2">❌ Failed</Text>
					<TouchableOpacity className="bg-white px-3 py-1 rounded" onPress={onRetry}>
						<Text className="text-xs text-[#007aff] font-semibold">Retry</Text>
					</TouchableOpacity>
				</View>
			)}

			{photo.uploadStatus === "completed" && (
				<View className="absolute top-1 right-1">
					<View className="bg-[#34c759] rounded-full w-6 h-6 items-center justify-center">
						<Text className="text-xs text-white">✓</Text>
					</View>
				</View>
			)}

			{/* Delete Button */}
			{canEdit && (
				<TouchableOpacity
					className="absolute top-1 left-1 bg-[#ff3b30] rounded-full w-6 h-6 items-center justify-center"
					onPress={onDelete}
				>
					<Text className="text-xs text-white font-bold">×</Text>
				</TouchableOpacity>
			)}
		</View>
	)
}
