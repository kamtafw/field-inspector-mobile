import { Model } from "@nozbe/watermelondb"
import { field, relation, text } from "@nozbe/watermelondb/decorators"
import Inspection from "./Inspection"

export default class Photo extends Model {
	static table = "photos"

	static associations = {
		inspections: { type: "belongs_to" as const, key: "inspection_id" },
	} as const

	@text("inspection_id") inspectionId!: string
	@relation("inspections", "inspection_id") inspection!: Inspection

	// local file path (before upload)
	@text("local_uri") localUri!: string

	// S3 details (after upload)
	@text("cloudinary_public_id") cloudinaryPublicId?: string
	@text("cloudinary_url") cloudinaryUrl?: string

	// upload state
	@text("upload_status") uploadStatus!: "pending" | "uploading" | "completed" | "failed"
	@field("upload_progress") uploadProgress!: number
	@text("upload_error") uploadError?: string

	// metadata
	@field("file_size") fileSize!: number // bytes
	@field("width") width?: number
	@field("height") height?: number
	@text("mime_type") mimeType!: string // image/jpeg, image/png

	// timestamps
	@field("captured_ts") capturedTs!: number
	@field("uploaded_ts") uploadedTs?: number
	@field("created_ts") createdTs!: number
}
