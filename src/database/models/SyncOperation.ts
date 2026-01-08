import { Model } from "@nozbe/watermelondb"
import { date, field, json, readonly, text } from "@nozbe/watermelondb/decorators"

export type OperationType = "CREATE_INSPECTION" | "UPDATE_INSPECTION"

export type OperationStatus = "pending" | "in_progress" | "completed" | "failed"

export default class SyncOperation extends Model {
	static table = "sync_operations"

	@field("operation_type") operationType!: OperationType
	@text("entity_id") entityId!: string // Inspection local id
	@field("entity_type") entityType!: "inspection" | "photo"

	@json("payload", (json) => json) payload!: any

	@text("idempotency_key") idempotencyKey!: string
	@field("status") status!: OperationStatus
	@field("retry_count") retryCount!: number
	@field("max_retries") maxRetries!: number

	@field("last_attempt_ts") lastAttemptTs?: number
	@field("next_retry_ts") nextRetryTs?: number
	@text("error_message") errorMessage?: string

	@readonly @field("created_ts") createdTs!: number
	@field("completed_ts") completedTs!: number

	get shouldRetry(): boolean {
		return this.status === "failed" && this.retryCount < this.maxRetries
	}

	get isReady(): boolean {
		if (this.status !== "pending" && this.status !== "failed") {
			return false
		}

		if (this.nextRetryTs && this.nextRetryTs > Date.now()) {
			return false // wait for backoff
		}
		
		return true
	}
}
