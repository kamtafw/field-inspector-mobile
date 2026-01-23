import * as FileSystem from "expo-file-system/legacy"
import NetInfo from "@react-native-community/netinfo"
import PhotosAPI from "@/src/services/api/photos.api"
import PhotoRepository from "@/src/database/repositories/PhotoRepository"
import InspectionRepository from "@/src/database/repositories/InspectionRepository"

interface UploadProgress {
	photoId: string
	progress: number
}

class PhotoUploadService {
	private isProcessing = false
	private progressListeners: Array<(progress: UploadProgress) => void> = []

	/** Start processing photo upload queue */
	async initialize(): Promise<void> {
		console.log("📸 PhotoUploadService: Initializing...")

		NetInfo.addEventListener((state) => {
			if (state.isConnected && !this.isProcessing) {
				console.log("✅ Network available, processing photo uploads...")
				this.processQueue()
			}
		})

		const netState = await NetInfo.fetch()
		if (netState.isConnected) {
			await this.processQueue()
		}
	}

	/** Process all pending photo uploads */
	async processQueue(): Promise<void> {
		if (this.isProcessing) {
			console.log("⏳ Already processing photo uploads, skipping...")
			return
		}

		const netState = await NetInfo.fetch()
		if (!netState.isConnected) {
			console.log("📴 Offline, cannot upload photos")
			return
		}

		this.isProcessing = true

		try {
			const pendingPhotos = await PhotoRepository.getPendingUploads()

			if (pendingPhotos.length === 0) {
				console.log("✅ No pending photo uploads")
				return
			}

			console.log(`📸 Processing ${pendingPhotos.length} pending photo uploads...`)

			// process photos one at a time (avoid overwhelming S3)
			for (const photo of pendingPhotos) {
				try {
					await this.uploadPhoto(photo.id)
				} catch (err: any) {
					console.error(`❌ Failed to upload photo ${photo.id}:`, err.message)
					// continue with next photo
				}
			}

			console.log("✅ Photo upload queue processed")
		} catch (err) {
			console.error("❌ Photo upload queue error:", err)
		} finally {
			this.isProcessing = false
		}
	}

	/** Upload a single photo to Cloudinary */
	async uploadPhoto(photoId: string): Promise<void> {
		const photo = await PhotoRepository.getById(photoId)
		if (!photo) {
			throw new Error(`Photo ${photoId} not found`)
		}

		const inspection = await InspectionRepository.getById(photo.inspectionId)
		if (!inspection) {
			throw new Error(`Inspection ${photo.inspectionId} not found`)
		}

		if (!inspection.remoteId) {
			const errorMsg = "Cannot upload photo: inspection not synced yet (no remote_id)"
			console.warn(errorMsg)
			await PhotoRepository.markFailed(photoId, errorMsg)
			throw new Error(errorMsg)
		}

		console.log(`📸 Uploading photo: ${photoId} to Cloudinary...`)

		try {
			await PhotoRepository.markUploading(photoId)
			this.notifyProgress({ photoId, progress: 0 })

			// step 1: request pre-signed URL from server
			console.log("📝 Requesting upload URL from backend...")
			const uploadData = await PhotosAPI.requestUploadParams({
				inspection_id: inspection.remoteId,
			})

			this.notifyProgress({ photoId, progress: 10 })

			// step 2: upload directly to Cloudinary
			console.log("☁️ Uploading to Cloudinary...")
			const cloudinaryResponse = await this.uploadToCloudinary(
				photo.localUri,
				uploadData.upload_url,
				uploadData.upload_params,
				(progress) => {
					const mappedProgress = 10 + progress * 0.8
					this.notifyProgress({ photoId, progress: mappedProgress })
				}
			)

			this.notifyProgress({ photoId, progress: 90 })

			// step 3: confirm upload with backend
			console.log("✅ Confirming upload with backend...")
			await PhotosAPI.confirmUpload({
				inspection_id: inspection.remoteId,
				cloudinary_public_id: cloudinaryResponse.public_id,
				cloudinary_url: cloudinaryResponse.secure_url,
				file_size: photo.fileSize,
				width: photo.width,
				height: photo.height,
			})

			// mark as uploaded
			await PhotoRepository.markUploaded(
				photoId,
				cloudinaryResponse.public_id,
				cloudinaryResponse.secure_url
			)
			this.notifyProgress({ photoId, progress: 100 })

			console.log(`✅ Photo ${photoId} uploaded successfully to Cloudinary`)
		} catch (err: any) {
			console.error("❌ Photo upload failed:", err)
			await PhotoRepository.markFailed(photoId, err.message || "Upload failed")
			throw err
		}
	}

	/** Upload file to Cloudinary using signed parameters */
	private async uploadToCloudinary(
		localUri: string,
		uploadUrl: string,
		params: Record<string, any>,
		onProgress?: (progress: number) => void
	): Promise<{ public_id: string; secure_url: string }> {
		try {
			const formData = new FormData()

			// add params in exact order they were signed
			formData.append("api_key", params.api_key)
			formData.append("timestamp", params.timestamp.toString())
			formData.append("signature", params.signature)

			if (params.folder) formData.append("folder", params.folder)
			if (params.public_id) formData.append("public_id", params.public_id)

			const file = {
				uri: localUri,
				type: "image/jpeg",
				name: "photo.jpg",
			} as any

			formData.append("file", file)

			console.log("📤 Uploading to Cloudinary with params:", {
				api_key: params.api_key,
				timestamp: params.timestamp,
				folder: params.folder,
				public_id: params.public_id,
				has_signature: !!params.signature,
			})

			// upload to Cloudinary
			const xhr = new XMLHttpRequest()

			return new Promise((resolve, reject) => {
				// progress tracking
				xhr.upload.addEventListener("progress", (event) => {
					if (event.lengthComputable) {
						const progress = event.loaded / event.total
						onProgress?.(progress)
					}
				})

				// success
				xhr.addEventListener("load", () => {
					console.log("📥 Cloudinary response status:", xhr.status)
					console.log("📥 Cloudinary response:", xhr.responseText)

					if (xhr.status === 200) {
						try {
							const response = JSON.parse(xhr.responseText)
							resolve({
								public_id: response.public_id,
								secure_url: response.secure_url,
							})
						} catch (err) {
							reject(new Error("Failed to parse Cloudinary response"))
						}
					} else {
						reject(new Error(`Upload failed with status ${xhr.status}`))
					}
				})

				// error
				xhr.addEventListener("error", () => {
					reject(new Error("Network error during upload"))
				})

				// timeout
				xhr.addEventListener("timeout", () => {
					reject(new Error("Upload timeout"))
				})

				// start upload
				xhr.open("POST", uploadUrl)
				xhr.timeout = 60000 // 60 second timeout
				xhr.send(formData)
			})
		} catch (err) {
			console.error("Cloudinary upload error:", err)
			throw err
		}
	}

	/** Retry a failed upload */
	async retryUpload(photoId: string): Promise<void> {
		await PhotoRepository.retryUpload(photoId)
		await this.processQueue()
	}

	/** Add progress listener */
	addProgressListener(callback: (progress: UploadProgress) => void): void {
		this.progressListeners.push(callback)
	}

	/** Remove progress listener */
	removeProgressListener(callback: (progress: UploadProgress) => void): void {
		this.progressListeners = this.progressListeners.filter((cb) => cb !== callback)
	}

	/** Notify all progress listeners */
	private notifyProgress(progress: UploadProgress): void {
		this.progressListeners.forEach((callback) => callback(progress))
	}

	/** Get upload statistics */
	async getStats() {
		return await PhotoRepository.getUploadStats()
	}
}

export default new PhotoUploadService()
