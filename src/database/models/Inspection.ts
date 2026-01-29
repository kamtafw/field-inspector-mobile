import { Model } from "@nozbe/watermelondb"
import { field, text, json } from "@nozbe/watermelondb/decorators"

export interface InspectionResponse {
	[itemId: string]: {
		value: string | number | boolean | null
		notes?: string
		timestamp: number
	}
}

/*
status → business state
	- draft
	- submitted
	- synced
	- conflict
is_synced → transport state
	- false = local only
	- true = confirmed by backend
*/

export default class Inspection extends Model {
	static table = "inspections"

	@text("remote_id") remoteId?: string
	@text("template_id") templateId!: string
	@text("facility_address") facilityAddress!: string
	@text("facility_name") facilityName!: string

	@json("responses", (json) => json) responses!: InspectionResponse

	@field("version") version!: number
	@text("inspector_id") inspectorId!: string
	@field("status") status!: "draft" | "submitted" | "synced" | "conflict"

	@field("is_synced") isSynced!: boolean
	@field("synced_ts") syncedTs?: number
	@text("sync_error") syncError?: string

	@field("created_ts") createdTs!: number
	@field("updated_ts") updatedTs!: number
	@field("last_action_ts") lastActionTs!: number
	@field("submitted_ts") submittedTs?: number
}
