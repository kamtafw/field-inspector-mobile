import * as ImagePicker from "expo-image-picker"
import * as FileSystem from "expo-file-system/legacy"
import { manipulateAsync, SaveFormat } from "expo-image-manipulator"

interface CapturedPhoto {
	uri: string
	width: number
	height: number
	fileSize: number
	mimeType: string
}

class PhotoService {
	private readonly MAX_WIDTH = 1024
	private readonly MAX_HEIGHT = 1024
	private readonly QUALITY = 0.7

	/** Request camera permissions */
	async requestCameraPermissions(): Promise<boolean> {
		const status = await ImagePicker.requestCameraPermissionsAsync()
		return status.granted
	}

	/** Request media library permissions */
	async requestMediaLibraryPermissions(): Promise<boolean> {
		const status = await ImagePicker.requestMediaLibraryPermissionsAsync()
		return status.granted
	}

	/** Take photo with camera */
	async takePhoto(): Promise<CapturedPhoto | null> {
		try {
			const hasPermission = await this.requestCameraPermissions()
			if (!hasPermission) {
				throw new Error("Camera permission denied")
			}

			const result = await ImagePicker.launchCameraAsync({
				mediaTypes: ["images", "livePhotos"],
				allowsEditing: true,
				aspect: [4, 3],
				quality: 1,
			})

			if (result.canceled) {
				return null
			}

			const asset = result.assets[0]
			return await this.compressImage(asset.uri, asset.width, asset.height)
		} catch (err) {
			console.error("Failed to take photo:", err)
			throw err
		}
	}

	/** Pick photo from gallery */
	async pickPhoto(): Promise<CapturedPhoto | null> {
		try {
			const hasPermission = await this.requestMediaLibraryPermissions()
			if (!hasPermission) {
				throw new Error("Media library permission denied")
			}

			const result = await ImagePicker.launchImageLibraryAsync({
				mediaTypes: ImagePicker.MediaTypeOptions.Images,
				allowsEditing: true,
				aspect: [4, 3],
				quality: 1,
			})

			if (result.canceled) {
				return null
			}

			const asset = result.assets[0]
			return await this.compressImage(asset.uri, asset.width, asset.height)
		} catch (err) {
			console.error("Failed to pick photo:", err)
			throw err
		}
	}

	/**
	 * Compress image to reduce to file size
	 * Resizes to max 1024px and compresses to 70% quality
	 */
	private async compressImage(uri: string, width: number, height: number): Promise<CapturedPhoto> {
		try {
			console.log(`📸 Original image: ${width}x${height}`)

			// calculate new dimensions to maintain aspect ratio
			let newWidth = width
			let newHeight = height

			if (width > this.MAX_WIDTH || height > this.MAX_HEIGHT) {
				const aspectRatio = width / height

				if (width > height) {
					newWidth = this.MAX_WIDTH
					newHeight = Math.round(this.MAX_WIDTH / aspectRatio)
				} else {
					newHeight = this.MAX_HEIGHT
					newWidth = Math.round(this.MAX_HEIGHT * aspectRatio)
				}
			}

			const compressed = await manipulateAsync(
				uri,
				[{ resize: { width: newWidth, height: newHeight } }],
				{ compress: this.QUALITY, format: SaveFormat.JPEG }
			)

			const fileInfo = await FileSystem.getInfoAsync(compressed.uri)
			const fileSize = fileInfo.exists && "size" in fileInfo ? fileInfo.size : 0

			console.log(
				`✅ Compressed image: ${compressed.width}x${compressed.height}, ` +
					`size: ${(fileSize / 1024).toFixed(2)}KB`
			)

			return {
				uri: compressed.uri,
				width: compressed.width,
				height: compressed.height,
				fileSize,
				mimeType: "image/jpeg",
			}
		} catch (err) {
			console.error("Failed to compress image:", err)
			throw err
		}
	}

	/** Delete local photo file */
	async deleteLocalFile(uri: string): Promise<void> {
		try {
			const fileInfo = await FileSystem.getInfoAsync(uri)
			if (fileInfo.exists) {
				await FileSystem.deleteAsync(uri, { idempotent: true })
				console.log(`🗑️ Deleted local file: ${uri}`)
			}
		} catch (err) {
			console.error("Failed to delete local file:", err)
			// file might already be deleted
		}
	}

	/** Get file info */
	async getFileInfo(uri: string): Promise<FileSystem.FileInfo> {
		return await FileSystem.getInfoAsync(uri)
	}
}

export default new PhotoService()
