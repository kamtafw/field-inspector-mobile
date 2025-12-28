import { Model } from "@nozbe/watermelondb"
import { field, text, date, readonly, json } from "@nozbe/watermelondb/decorators"

export interface InspectionResponse {
	[itemId: string]: {
		value: string
		notes?: string
		timestamp: number
	}
}

export default class Inspection extends Model {
	static table = "inspections"

	// @text("remote_id") remoteId?: string
	@text("template_id") templateId!: string
	@text("facility_address") facilityAddress!: string
	@text("facility_name") facilityName!: string

	@json("responses", (json) => json) responses!: InspectionResponse

	@field("version") version!: number
	@text("inspector_id") inspectorId!: string
	@field("status") status!: "draft" | "submitted" | "synced" | "conflict"

	@field("is_synced") isSynced!: boolean
	// @date("synced_at") syncedAt?: Date
	// @text("synced_error") syncedError?: string

	@readonly @date("created_at") createdAt!: Date
	@readonly @date("updated_at") updatedAt!: Date
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
