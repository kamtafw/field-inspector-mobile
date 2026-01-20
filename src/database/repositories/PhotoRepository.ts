import { Q } from "@nozbe/watermelondb"
import database from ".."
import Photo from "../models/Photo"

interface CreatePhotoPayload {
	inspectionId: string
	localUri: string
	fileSize: number
	width?: number
	height?: number
	mimeType: string
}

class PhotoRepository {
	collection = database.get<Photo>("photos")

	/** READS */

	/** Get all photos for an inspection */
	async getByInspectionId(inspectionId: string): Promise<Photo[]> {
		return await this.collection
			.query(Q.where("inspection_id", inspectionId), Q.sortBy("captured_ts", Q.desc))
			.fetch()
	}

	/** Get photo by ID */
	async getById(id: string): Promise<Photo | null> {
		try {
			return await this.collection.find(id)
		} catch {
			return null
		}
	}

	/** Get all pending uploads */
	async getPendingUploads(): Promise<Photo[]> {
		return await this.collection
			.query(
				Q.where("upload_status", Q.oneOf(["pending", "failed"])),
				Q.sortBy("captured_ts", Q.asc)
			)
			.fetch()
	}

	/** Get upload statistics */
	async getUploadStats(): Promise<{
		total: number
		pending: number
		uploading: number
		completed: number
		failed: number
	}> {
		const [total, pending, uploading, completed, failed] = await Promise.all([
			this.collection.query().fetchCount(),
			this.collection.query(Q.where("upload_status", "pending")).fetchCount(),
			this.collection.query(Q.where("upload_status", "uploading")).fetchCount(),
			this.collection.query(Q.where("upload_status", "completed")).fetchCount(),
			this.collection.query(Q.where("upload_status", "failed")).fetchCount(),
		])

		return { total, pending, uploading, completed, failed }
	}

	/** WRITES */

	/** Create new photo record */
	async create(data: CreatePhotoPayload): Promise<Photo> {
		const now = Date.now()

		const photo = await database.write(async () => {
			return await this.collection.create((record) => {
				record.inspectionId = data.inspectionId
				record.localUri = data.localUri
				record.fileSize = data.fileSize
				record.width = data.width
				record.height = data.height
				record.mimeType = data.mimeType
				record.uploadStatus = "pending"
				record.uploadProgress = 0
				record.capturedTs = now
				record.createdTs = now
			})
		})

		console.log(`📸 Photo record created: ${photo.id}`)
		return photo
	}

	/** Mark photo as uploading */
	async markUploading(photoId: string): Promise<void> {
		const photo = await this.getById(photoId)
		if (!photo) return

		await database.write(async () => {
			await photo.update((record) => {
				record.uploadStatus = "uploading"
				record.uploadProgress = 0
				record.uploadError = undefined
			})
		})
	}

	/** Update upload progress */
	async updateProgress(photoId: string, progress: number): Promise<void> {
		const photo = await this.getById(photoId)
		if (!photo) return

		await database.write(async () => {
			await photo.update((record) => {
				record.uploadProgress = Math.min(100, Math.max(0, progress))
			})
		})
	}

	/** Mark photo as uploaded */
	async markUploaded(photoId: string, s3Key: string, s3Url: string): Promise<void> {
		const photo = await this.getById(photoId)
		if (!photo) return

		await database.write(async () => {
			await photo.update((record) => {
				record.uploadStatus = "completed"
				record.uploadProgress = 100
				record.s3Key = s3Key
				record.s3Url = s3Url
				record.uploadedTs = Date.now()
				record.uploadError = undefined
			})
		})

		console.log(`✅ Photo uploaded: ${photoId} → ${s3Key}`)
	}

	/** Mark photo upload as failed */
	async markFailed(photoId: string, error: string): Promise<void> {
		const photo = await this.getById(photoId)
		if (!photo) return

		await database.write(async () => {
			await photo.update((record) => {
				record.uploadStatus = "failed"
				record.uploadError = error
			})
		})

		console.log(`❌ Photo upload failed: ${photoId} - ${error}`)
	}

	/** Retry failed upload */
	async retryUpload(photoId: string): Promise<void> {
		const photo = await this.getById(photoId)
		if (!photo) return

		await database.write(async () => {
			await photo.update((record) => {
				record.uploadStatus = "pending"
				record.uploadProgress = 0
				record.uploadError = undefined
			})
		})

		console.log(`🔄 Retrying photo upload: ${photoId}`)
	}

	/** Delete photo */
	async delete(photoId: string): Promise<void> {
		const photo = await this.getById(photoId)
		if (!photo) return

		await database.write(async () => {
			await photo.markAsDeleted()
		})

		console.log(`🗑️ Photo deleted: ${photoId}`)
	}
}

export default new PhotoRepository()
