import { Q } from "@nozbe/watermelondb"
import database from ".."
import SyncOperation from "../models/SyncOperation"

class SyncRepository {
	private collection = database.get<SyncOperation>("sync_operations")

	/** READS */

	/** Get all pending operations ready to process */
	async getPendingOperations(): Promise<SyncOperation[]> {
		const now = Date.now()

		const pendingOperations = await this.collection
			.query(
				Q.or(
					Q.where("status", "pending"),
					Q.and(Q.where("status", "failed"), Q.where("retry_count", Q.lt(5)))
				),
				Q.sortBy("created_ts", Q.asc)
			)
			.fetch()

		const readyOperations = pendingOperations.filter((op) => {
			// pending operations are always ready
			if (op.status === "pending") {
				return true
			}

			// failed operations must wait for backoff
			if (op.status === "failed") {
				if (!op.nextRetryTs) {
					return true // no backoff set, ready to retry
				}

				const isReady = now >= op.nextRetryTs

				if (!isReady) {
					const waitSeconds = Math.ceil((op.nextRetryTs - now) / 1000)
					console.log(`⏳ Operation ${op.id} waiting ${waitSeconds}s before retry`)
				}

				return isReady
			}

			return false
		})

		console.log(
			`📋 Found ${pendingOperations.length} pending/failed operations, ` +
				`${readyOperations.length} ready to process`
		)

		return readyOperations
	}

	/** Check if operation already exists (idempotency check) */
	async existsByIdempotencyKey(key: string): Promise<boolean> {
		const count = await this.collection.query(Q.where("idempotency_key", key)).fetchCount()

		return count > 0
	}

	/** Get operations by entity id */
	async getByEntityId(entityId: string): Promise<SyncOperation[]> {
		return await this.collection.query(Q.where("entity_id", entityId)).fetch()
	}

	/** Get sync operations queue statistics */
	async getQueueStats(): Promise<{
		pending: number
		inProgress: number
		failed: number
		completed: number
	}> {
		const [pending, inProgress, failed, completed] = await Promise.all([
			this.collection.query(Q.where("status", "pending")).fetchCount(),
			this.collection.query(Q.where("status", "in_progress")).fetchCount(),
			this.collection.query(Q.where("status", "failed")).fetchCount(),
			this.collection.query(Q.where("status", "completed")).fetchCount(),
		])

		return { pending, inProgress, failed, completed }
	}

	/** WRITES */

	/** Mark operation as in progress */
	async markInProgress(operationId: string): Promise<void> {
		const operation = await this.collection.find(operationId)

		await database.write(async () => {
			await operation.update((record) => {
				record.status = "in_progress"
				record.lastAttemptTs = Date.now()
			})
		})
	}

	/** Mark operation as completed */
	async markCompleted(operationId: string): Promise<void> {
		const operation = await this.collection.find(operationId)

		await database.write(async () => {
			await operation.update((record) => {
				record.status = "completed"
				record.completedTs = Date.now()
			})
		})
	}

	/** Mark operation as failed - retry with exponential backoff */
	async markFailed(operationId: string, error: string): Promise<void> {
		const operation = await this.collection.find(operationId)
		const newRetryCount = operation.retryCount + 1

		// exponential backoff: 2^retryCount seconds
		const backoffSeconds = Math.min(Math.pow(2, newRetryCount), 64) // max 64s
		const nextRetryTs = Date.now() + backoffSeconds * 1000

		await database.write(async () => {
			await operation.update((record) => {
				record.status = "failed"
				record.retryCount = newRetryCount
				record.errorMessage = error
				record.nextRetryTs = nextRetryTs
			})
		})

		console.log(
			`❌ Operation ${operationId} failed (attempt ${newRetryCount}/${operation.maxRetries}). ` +
				`Next retry in ${backoffSeconds}s at ${new Date(nextRetryTs).toLocaleTimeString()}`
		)
	}

	/** Clear completed operations older than 7 days */
	async cleanupOldOperations(): Promise<number> {
		const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

		const oldOps = await this.collection
			.query(Q.where("status", "completed"), Q.where("completed_ts", Q.lt(sevenDaysAgo)))
			.fetch()

		await database.write(async () => {
			await Promise.all(oldOps.map((op) => op.markAsDeleted()))
		})

		return oldOps.length
	}
}

export default new SyncRepository()
