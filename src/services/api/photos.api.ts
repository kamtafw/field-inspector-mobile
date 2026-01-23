import api from "./client"

interface RequestUploadParamsPayload {
	inspection_id: string
}

interface UploadParamsResponse {
	upload_url: string
	upload_params: {
		api_key: string
		timestamp: number
		signature: string
		folder: string
		public_id: string
	}
	public_id: string
	cloudinary_url: string
}

interface ConfirmUploadPayload {
	inspection_id: string
	cloudinary_public_id: string
	cloudinary_url: string
	file_size: number
	width?: number
	height?: number
}

interface PhotoResponse {
	id: string
	inspection: string
	cloudinary_public_id: string
	cloudinary_url: string
	thumbnail_url: string
	medium_url: string
	file_size: number
	width?: number
	height?: number
	uploaded_at: string
}

class PhotosAPI {
	/** Request Cloudinary signed upload parameters */
	async requestUploadParams(payload: RequestUploadParamsPayload): Promise<UploadParamsResponse> {
		const response = await api.post<UploadParamsResponse>("/photos/upload-params/", payload)
		return response.data
	}

	/** Confirm that photo was uploaded to Cloudinary */
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
		await api.delete(`/photos/${photoId}/`)
	}
}

export default new PhotosAPI()
