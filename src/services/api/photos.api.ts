import api from "./client"

interface RequestUploadUrlPayload {
	inspection_id: string
	file_extension: string
	content_type: string
}

interface UploadUrlResponse {
	upload_url: string
	upload_fields: Record<string, string>
	s3_key: string
	s3_url: string
}

interface ConfirmUploadPayload {
	inspection_id: string
	s3_key: string
	s3_url: string
	file_size: number
	width?: number
	height?: number
}

interface PhotoResponse {
	id: string
	inspection: string
	s3_key: string
	s3_url: string
	file_size: number
	width?: number
	height?: number
	uploaded_at: string
}

class PhotosAPI {
	/** Request pre-signed URL for uploading photo to S3 */
	async requestUploadUrl(payload: RequestUploadUrlPayload): Promise<UploadUrlResponse> {
		const response = await api.post<UploadUrlResponse>("/photos/upload-url/", payload)
		return response.data
	}

	/** Confirm that photo was uploaded to S3 */
	async confirmUpload(payload: ConfirmUploadPayload): Promise<PhotoResponse> {
		const response = await api.post<PhotoResponse>("/photos/confirm-upload/", payload)
		return response.data
	}

	/** Get all photos for an inspection */
	async getPhotos(inspectionId: string): Promise<PhotoResponse[]> {
		const response = await api.get<PhotoResponse[]>("/photos/", {
			params: { inspection_id: inspectionId },
		})
		return response.data
	}

	/** Delete a photo */
	async deletePhoto(photoId: string): Promise<void> {
		await api.delete(`/photos/${photoId}`)
	}
}

export default new PhotosAPI()
