import { Q } from "@nozbe/watermelondb"
import database from ".."
import SyncOperation from "../models/SyncOperations"

class SyncRepository {
	private collection = database.get<SyncOperation>("sync_operations")

	/* READS */

	async getPendingOperations(): Promise<SyncOperation[]> {
		const now = Date.now()

		return await this.collection
			.query(
				Q.or(Q.where("status", "pending"), Q.where("status", "failed")),
				Q.sortBy("created_ts", Q.asc)
			)
			.fetch()
			.then((ops) => ops.filter((op) => op.isReady))
	}

	async existsByIdempotencyKey(key: string): Promise<boolean> {
		// Check if operation already exists (idempotency check)
		const count = await this.collection.query(Q.where("idempotency_key", key)).fetchCount()

		return count > 0
	}

	async getByEntityId(entityId: string): Promise<SyncOperation[]> {
		// Get operations by entity id
		return await this.collection.query(Q.where("entity_id", entityId)).fetch()
	}

	/* WRITES */

	async markInProgress(operationId: string): Promise<void> {
		// Mark operation as in progress
		const operation = await this.collection.find(operationId)

		await database.write(async () => {
			await operation.update((record) => {
				record.status = "in_progress"
			})
		})
	}

	async markCompleted(operationId: string): Promise<void> {
		// Mark operation as completed
		const operation = await this.collection.find(operationId)

		await database.write(async () => {
			await operation.update((record) => {
				record.status = "completed"
			})
		})
	}

	async markFailed(operationId: string): Promise<void> {
		// Mark operation as failed
		const operation = await this.collection.find(operationId)

		await database.write(async () => {
			await operation.update((record) => {
				record.status = "failed"
			})
		})
	}
}
