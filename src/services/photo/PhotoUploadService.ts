import * as FileSystem from "expo-file-system"
import NetInfo from "@react-native-community/netinfo"
import PhotosAPI from "@/src/services/api/photos.api"
import PhotoRepository from "@/src/database/repositories/PhotoRepository"
import InspectionRepository from "@/src/database/repositories/InspectionRepository"

interface UploadProgress {
	photoId: string
	progress: number
}

interface PhotoWaitingState {
	photoId: string
	inspectionId: string
	attempts: number
	firstAttemptTs: number
}

class PhotoUploadService {
	private isProcessing = false
	private progressListeners: Array<(progress: UploadProgress) => void> = []
	private networkUnsubscribe?: () => void

	// track photos waiting for inspection remoteId
	private waitingPhotos = new Map<string, PhotoWaitingState>()
	private readonly MAX_WAIT_ATTEMPTS = 10
	private readonly MAX_WAIT_TIME = 30 * 60 * 1000

	/** Start processing photo upload queue */
	async initialize(): Promise<void> {
		console.log("📸 PhotoUploadService: Initializing...")

		this.networkUnsubscribe = NetInfo.addEventListener((state) => {
			console.log("📸 Network changed:", state.isConnected ? "ONLINE" : "OFFLINE")

			if (state.isConnected && !this.isProcessing) {
				console.log("✅ Network available, processing photo uploads...")
				this.processQueue()
			}
		})

		const netState = await NetInfo.fetch()
		if (netState.isConnected) {
			await this.processQueue()
		}

		setInterval(() => this.checkWaitingPhotos(), 30000) // check waiting photos every 30s
	}

	/** Clean up on app close */
	cleanup(): void {
		if (this.networkUnsubscribe) {
			this.networkUnsubscribe()
		}
	}

	/** Check if waiting photos can now be uploaded */
	private async checkWaitingPhotos(): Promise<void> {
		if (this.waitingPhotos.size === 0) return

		console.log(`📸 Checking ${this.waitingPhotos.size} photos waiting for inspection sync...`)

		const photosToRetry: string[] = []
		const photosToFail: string[] = []

		for (const [photoId, state] of this.waitingPhotos.entries()) {
			// check if inspection now has remoteId
			const inspection = await InspectionRepository.getById(state.inspectionId)

			if (inspection?.remoteId) {
				console.log(`✅ Inspection ${state.inspectionId} now synced, retrying photo ${photoId}`)
				photosToRetry.push(photoId)
				continue
			}

			// check if wait-time or wait-attempts has been exceeded
			const waitTime = Date.now() - state.firstAttemptTs
			if (waitTime > this.MAX_WAIT_TIME || state.attempts >= this.MAX_WAIT_ATTEMPTS) {
				console.log(
					`⏱️ Photo ${photoId} waited too long ` +
						`(${Math.round(waitTime / 60000)}m, ${state.attempts} attempts)`,
				)
				photosToFail.push(photoId)
			}
		}

		// retry photos whose inspections are now synced
		for (const photoId of photosToRetry) {
			this.waitingPhotos.delete(photoId)
			await PhotoRepository.retryUpload(photoId)
		}

		// mark photos that waited too long as failed
		for (const photoId of photosToFail) {
			this.waitingPhotos.delete(photoId)
			await PhotoRepository.markFailed(
				photoId,
				"Inspection failed to sync. Please retry inspection first.",
			)
		}

		// trigger queue if any photos became ready
		if (photosToRetry.length > 0) {
			this.processQueue()
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
				return
			}

			console.log(`📸 Processing ${pendingPhotos.length} pending photo uploads...`)

			const results = await Promise.allSettled(
				pendingPhotos.map((photo) => this.uploadPhoto(photo.id)),
			)

			const successful = results.filter((r) => r.status === "fulfilled").length
			const failed = results.filter((r) => r.status === "rejected").length

			console.log(
				`📸 Photo upload summary: ${successful} succeeded, ${failed} failed, ` +
					`${this.waitingPhotos.size} waiting for inspection sync`,
			)
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
			const existingState = this.waitingPhotos.get(photoId)

			if (existingState) {
				existingState.attempts++
				this.waitingPhotos.set(photoId, existingState)

				console.log(
					`⏳ Photo ${photoId} still waiting for inspection sync ` +
						`(attempt ${existingState.attempts}/${this.MAX_WAIT_ATTEMPTS})`,
				)
			} else {
				this.waitingPhotos.set(photoId, {
					photoId,
					inspectionId: inspection.id,
					attempts: 1,
					firstAttemptTs: Date.now(),
				})

				console.log(`⏳ Photo ${photoId} waiting for inspection ${inspection.id} to sync`)
			}

			// not marked as failed - skipped; will retry when inspection syncs
			return
		}

		this.waitingPhotos.delete(photoId)

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
				},
			)
			this.notifyProgress({ photoId, progress: 90 })

			// step 3: confirm upload with backend
			console.log("✅ Confirming upload...")
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
				cloudinaryResponse.secure_url,
			)
			this.notifyProgress({ photoId, progress: 100 })

			console.log(`✅ Photo ${photoId} uploaded successfully to Cloudinary`)
		} catch (err: any) {
			console.error("❌ Photo upload failed:", err)

			// don't marked as failed if it's a waiting issue
			const errorMsg = this.getErrorMessage(err)

			if (!errorMsg.includes("Waiting for inspection")) {
				await PhotoRepository.markFailed(photoId, errorMsg)
			}

			throw err
		}
	}

	/** Upload file to Cloudinary using signed parameters */
	private async uploadToCloudinary(
		localUri: string,
		uploadUrl: string,
		params: Record<string, any>,
		onProgress?: (progress: number) => void,
	): Promise<{ public_id: string; secure_url: string }> {
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

		const xhr = new XMLHttpRequest()

		return new Promise((resolve, reject) => {
			xhr.upload.addEventListener("progress", (event) => {
				if (event.lengthComputable) {
					const progress = event.loaded / event.total
					onProgress?.(progress)
				}
			})

			xhr.addEventListener("load", () => {
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

			xhr.addEventListener("error", () => {
				reject(new Error("Network error during upload"))
			})

			xhr.addEventListener("timeout", () => {
				reject(new Error("Upload timeout"))
			})

			xhr.open("POST", uploadUrl)
			xhr.timeout = 60000
			xhr.send(formData)
		})
	}

	/** Get user-friendly error message */
	private getErrorMessage(error: any): string {
		if (error.message?.includes("not synced") || error.message?.includes("not found")) {
			return "Waiting for inspection to sync"
		}
		if (error.message?.includes("Network")) {
			return "Network error"
		}
		if (error.response?.status === 401) {
			return "Upload credentials expired"
		}
		if (error.response?.status >= 500) {
			return "Server error"
		}
		return "Upload failed"
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

	/** Get list of photos waiting for inspection */
	getWaitingPhotos(): PhotoWaitingState[] {
		return Array.from(this.waitingPhotos.values())
	}
}

export default new PhotoUploadService()
