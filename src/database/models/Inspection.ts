import { Model } from "@nozbe/watermelondb"
import { field, text, json, date, readonly } from "@nozbe/watermelondb/decorators"

export interface InspectionResponse {
	[itemId: string]: {
		value: string
		notes?: string
		timestamp: number
	}
}

export default class Inspection extends Model {
	static table = "inspections"
	
	@text("inspector_id") inspectorId!: string
	@text("facility_name") facilityName!: string
	@field("status") status!: "draft" | "submitted" | "synced" | "conflict"
	@field("is_synced") isSynced!: boolean
	@readonly() createdAt!: Date
	@readonly() updatedAt!: Date

	// @text("remote_id") remoteId?: string
	// @text("template_id") templateId!: string
	// @text("facility_address") facilityAddress!: string

	// @json("responses", (json) => json) responses!: InspectionResponse

	// @field("version") version!: number

	// @date("synced_at") syncedAt?: Date
	// @text("synced_error") syncedError?: string

	// @date("submitted_at") submittedAt?: Date

	get needsSync(): boolean {
		// helper method: is this ready to sync?
		return !this.isSynced && this.status !== "draft"
	}

	get hasConflict(): boolean {
		// helper method: has unresolved conflict?
		return this.status === "conflict"
	}
}
