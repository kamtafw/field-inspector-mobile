// src/database/schema.ts
// src/database/models/Inspection.ts
// src/database/models/SyncOperation.ts
// src/database/index.ts
// src/database/repositories/InspectionRepository.ts
// src/database/repositories/SyncRepository.ts

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

	@text("remote_id") remoteId?: string
	@text("template_id") templateId!: string
	@text("facility_name") facilityName!: string
	@text("facility_address") facilityAddress!: string

	@json("responses", (json) => json) responses!: InspectionResponse

	@field("status") status!: "draft" | "submitted" | "synced" | "conflict"
	@field("version") version!: number
	@text("inspector_id") inspectorId!: string

	@field("is_synced") isSynced!: boolean
	@date("synced_at") syncedAt?: Date
	@text("synced_error") syncedError?: string

	@date("submitted_at") submittedAt?: Date
	@readonly() createdAt!: Date
	@readonly() updatedAt!: Date

	get needsSync(): boolean {
		// helper method: is this ready to sync?
		return !this.isSynced && this.status !== "draft"
	}

	get hasConflict(): boolean {
		// helper method: has unresolved conflict?
		return this.status === "conflict"
	}
}
