import { Model } from "@nozbe/watermelondb"
import { date, field, json, readonly, text } from "@nozbe/watermelondb/decorators"

export type OperationType = "CREATE_INSPECTION" | "UPDATE_INSPECTION"

export type OperationStatus = "pending" | "in_progress" | "completed" | "failed"

export default class SyncOperation extends Model {
	static table = "sync_operations"

	@field("operation_type") operationType!: OperationType
	@text("entity_id") entityId!: string
	@field("entity_type") entityType!: "inspection"

	@json("payload", (json) => json) payload!: any

	@text("idempotency_key") idempotencyKey!: string
	@field("status") status!: OperationStatus

	@field("created_ts") createdTs!: number
	@field("completed_ts") completedTs!: number

	@readonly @date("created_at") createdAt!: Date
	@readonly @date("completed_at") completedAt!: Date

	get isReady(): boolean {
		if (this.status !== "pending" && this.status !== "failed") {
			return false
		}

		return true
	}
}
