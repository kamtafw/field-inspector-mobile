export type InspectionStatus = "draft" | "submitted" | "synced" | "conflict"

export interface Inspection {
	id: string // ULID (client-generated)
	inspector_id: string

	facility_name: string // snapshot-lit
	status: InspectionStatus

	created_at: string
	updated_at: string
}
