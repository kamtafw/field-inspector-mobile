import { Q } from "@nozbe/watermelondb"
import database from ".."
import Conflict from "../models/Conflict"

export interface CreateConflictPayload {
	inspectionId: string
	clientVersion: number
	serverVersion: number
	clientData: any
	serverData: any
	conflictFields: string[]
	serverUpdatedBy: {
		name: string
		email: string
	}
	serverUpdatedTs: number
}

class ConflictRepository {
	private collection = database.get<Conflict>("conflicts")

	/** Create a conflict record */
	async create(data: CreateConflictPayload): Promise<Conflict> {
		const now = Date.now()

		const conflict = await database.write(async () => {
			const newConflict = await this.collection.create((record) => {
				record.inspectionId = data.inspectionId
				record.clientVersion = data.clientVersion
				record.serverVersion = data.serverVersion
				record.clientData = data.clientData
				record.serverData = data.serverData
				record.conflictFields = data.conflictFields

				if (data.serverUpdatedBy) {
					record.serverUpdatedByName = data.serverUpdatedBy.name
					record.serverUpdatedByEmail = data.serverUpdatedBy.email
				}
				if (data.serverUpdatedTs) {
					record.serverUpdatedTs = data.serverUpdatedTs
				}

				record.resolved = false
				record.createdTs = now
			})

			return newConflict
		})

		console.log("📝 Created new conflict:", conflict.id)
		return conflict
	}

	/** Get unresolved conflicts */
	async getUnresolved(): Promise<Conflict[]> {
		const unresolvedConflicts = await this.collection
			.query(Q.where("resolved", false), Q.sortBy("created_ts", Q.desc))
			.fetch()

		return unresolvedConflicts
	}

	/** Get by inspection id */
	async getByInspectionId(inspectionId: string): Promise<Conflict[]> {
		const records = await this.collection
			.query(Q.where("inspection_id", inspectionId), Q.sortBy("created_ts", Q.desc))
			.fetch()

		return records
	}

	/** Get conflict by ID */
	async getById(id: string): Promise<Conflict | null> {
		try {
			return await this.collection.find(id)
		} catch {
			return null
		}
	}

	/** Check if inspection has unresolved conflicts */
	async hasUnresolvedConflicts(inspectionId: string): Promise<boolean> {
		const count = await this.collection
			.query(Q.where("inspection_id", inspectionId), Q.where("resolved", false))
			.fetchCount()

		return count > 0
	}

	/** Mark conflict as resolved */
	async markResolved(
		conflictId: string,
		strategy: "keep_mine" | "keep_theirs" | "merge"
	): Promise<void> {
		const conflict = await this.collection.find(conflictId)

		await database.write(async () => {
			await conflict.update((record) => {
				record.resolved = true
				record.resolutionStrategy = strategy
				record.resolvedTs = Date.now()
			})
		})
	}

	/** Delete conflict */
	async delete(conflictId: string): Promise<void> {
		const conflict = await this.collection.find(conflictId)

		await database.write(async () => {
			await conflict.markAsDeleted()
		})
	}

	/** Delete all resolved conflicts older than 30 days */
	async cleanupOldConflicts(): Promise<number> {
		const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000

		const oldConflicts = await this.collection
			.query(Q.where("resolved", true), Q.where("resolved_at", Q.lt(thirtyDaysAgo)))
			.fetch()

		await database.write(async () => {
			await Promise.all(oldConflicts.map((c) => c.markAsDeleted()))
		})

		console.log(`🗑️ Cleaned up ${oldConflicts.length} old conflict records`)
		return oldConflicts.length
	}

	/** Get conflict statistics */
	async getStats(): Promise<{ total: number; unresolved: number; resolved: number }> {
		const total = await this.collection.query().fetchCount()
		const unresolved = await this.collection.query(Q.where("resolved", false)).fetchCount()
		const resolved = await this.collection.query(Q.where("resolved", true)).fetchCount()

		return { total, unresolved, resolved }
	}
}

export default new ConflictRepository()
