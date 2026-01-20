import * as FileSystem from "expo-file-system/legacy"
import NetInfo from "@react-native-community/netinfo"
import PhotosAPI from "@/src/services/api/photos.api"
import PhotoRepository from "@/src/database/repositories/PhotoRepository"

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

	/** Upload a single photo to S3 */
	async uploadPhoto(photoId: string): Promise<void> {
		const photo = await PhotoRepository.getById(photoId)
		if (!photo) {
			throw new Error(`Photo ${photoId} not found`)
		}

		console.log(`📸 Uploading photo: ${photoId}...`)

		try {
			await PhotoRepository.markUploading(photoId)
			this.notifyProgress({ photoId, progress: 0 })

			// step 1: request pre-signed URL from server
			console.log("📝 Requesting upload URL from backend...")
			const uploadData = await PhotosAPI.requestUploadUrl({
				inspection_id: photo.inspectionId,
				file_extension: photo.mimeType === "image/png" ? "png" : "jpg",
				content_type: photo.mimeType,
			})

			this.notifyProgress({ photoId, progress: 10 })

			// step 2: upload directly to S3
			console.log("☁️ Uploading to S3...")
			await this.uploadToS3(
				photo.localUri,
				uploadData.upload_url,
				uploadData.upload_fields,
				(progress) => {
					const mappedProgress = 10 + progress * 0.8
					this.notifyProgress({ photoId, progress: mappedProgress })
				}
			)

			this.notifyProgress({ photoId, progress: 90 })

			// step 3: confirm upload with backend
			console.log("✅ Confirming upload with backend...")
			await PhotosAPI.confirmUpload({
				inspection_id: photo.inspectionId,
				s3_key: uploadData.s3_key,
				s3_url: uploadData.s3_url,
				file_size: photo.fileSize,
				width: photo.width,
				height: photo.height,
			})

			// mark as uploaded
			await PhotoRepository.markUploaded(photoId, uploadData.s3_key, uploadData.s3_url)
			this.notifyProgress({ photoId, progress: 100 })

			console.log(`✅ Photo ${photoId} uploaded successfully`)
		} catch (err: any) {
			console.error("❌ Photo upload failed:", err)
			await PhotoRepository.markFailed(photoId, err.message || "Upload failed")
			throw err
		}
	}

	/** Upload file to S3 using pre-signed POST */
	private async uploadToS3(
		localUri: string,
		uploadUrl: string,
		fields: Record<string, string>,
		onProgress?: (progress: number) => void
	): Promise<void> {
		try {
			const formData = new FormData()

			// add all required fields from pre-signed POST
			Object.keys(fields).forEach((key) => {
				formData.append(key, fields[key])
			})

			const file = {
				uri: localUri,
				type: fields["Content-Type"] || "image/jpeg",
				name: "photo.jpg",
			} as any

			formData.append("file", file)

			// upload to S3
			const uploadTask = FileSystem.createUploadTask(
				uploadUrl,
				localUri,
				{
					httpMethod: "POST",
					uploadType: FileSystem.FileSystemUploadType.MULTIPART,
					fieldName: "file",
					parameters: fields,
				},
				(data) => {
					const progress = data.totalBytesSent / data.totalBytesExpectedToSend
					onProgress?.(progress)
				}
			)

			const result = await uploadTask.uploadAsync()

			if (!result || result.status !== 204) {
				throw new Error(`S3 upload failed with status ${result?.status}`)
			}
		} catch (err) {
			console.error("S3 upload error:", err)
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
