import { Model } from "@nozbe/watermelondb"
import { field, json, text } from "@nozbe/watermelondb/decorators"

export interface ConflictField {
	field: string
	clientValue: any
	serverValue: any
	// lastModified: number
}

export default class Conflict extends Model {
	static table = "conflicts"
	static associations = {
		inspections: { type: "belongs_to" as const, key: "inspection_id" },
	}

	@text("inspection_id") inspectionId!: string
	@field("client_version") clientVersion!: number
	@field("server_version") serverVersion!: number

	@json("client_data", (json) => json) clientData!: any
	@json("server_data", (json) => json) serverData!: any
	@json("conflict_fields", (json) => json) conflictFields!: string[]

	@field("resolved") resolved!: boolean
	@text("resolution_strategy") resolutionStrategy?: "keep_mine" | "keep_theirs" | "merge"
	@field("resolved_ts") resolvedTs?: number

	@field("created_ts") createdTs!: number

	get detailedConflicts(): ConflictField[] {
		const conflicts: ConflictField[] = []

		const simpleFields = ["facility_name", "facility_address", "status"]
		for (const field of simpleFields) {
			if (this.conflictFields.includes(field)) {
				conflicts.push({
					field,
					clientValue: this.clientData[field],
					serverValue: this.serverData[field],
				})
			}
		}

		const clientResponses = this.clientData.responses || {}
		const serverResponses = this.serverData.responses || {}

		for (const conflictField of this.conflictFields) {
			if (conflictField.startsWith("responses.")) {
				const itemId = conflictField.replace("responses.", "")
				conflicts.push({
					field: `responses.${itemId}`,
					clientValue: clientResponses[itemId],
					serverValue: serverResponses[itemId],
				})
			}
		}

		return conflicts
	}
}
