import { Model } from "@nozbe/watermelondb"
import { field, text, json } from "@nozbe/watermelondb/decorators"

export default class InspectionTemplate extends Model {
	static table = "inspection_templates"

	@text("remote_id") remoteId?: string
	@text("name") name!: string

	@field("version") version!: number
	@json("checklist_items", (json) => json) checklistItems!: any

	@field("synced_ts") syncedTs?: number
	@field("created_ts") createdTs!: number
}
