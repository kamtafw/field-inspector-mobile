import "react-native-get-random-values"
import { v4 as uuid4 } from "uuid"
import { Q } from "@nozbe/watermelondb"
import Inspection, { InspectionResponse } from "../models/Inspection"
import SyncOperation from "../models/SyncOperation"
import database from ".."

/*
TODO: before saving: const responses = JSON.parse(JSON.stringify(input.responses))
- ensures serializability
- strips accidental functions or refs
- guarantees backend-safe shape
** this is quiet but powerful hardening move

TODO: avoid partial writes; ensure:
- DB write happens inside a single WatermelonDB action
- no async branching inside write block
** this prevents corrupted rows
*/

export interface CreateInspectionPayload {
	templateId: string
	facilityName: string
	facilityAddress: string
	responses?: InspectionResponse
}

export interface UpdateInspectionPayload {
	facilityName?: string
	facilityAddress?: string
	responses?: InspectionResponse
	status?: "draft" | "submitted"
}

class InspectionRepository {
	collection = database.get<Inspection>("inspections")
	private syncCollection = database.get<SyncOperation>("sync_operations")

	/** READS */

	/** Get all inspections for a user */
	async getAll(userId: string): Promise<Inspection[]> {
		return await this.collection
			.query(Q.where("inspector_id", userId), Q.sortBy("created_at", Q.desc))
			.fetch()
	}

	/** Get inspection by local ID */
	async getById(id: string): Promise<Inspection | null> {
		try {
			return await this.collection.find(id)
		} catch {
			return null
		}
	}

	/** Get inspection by remote ID (server UUID) */
	async getByRemoteId(remoteId: string): Promise<Inspection | null> {
		const records = await this.collection.query(Q.where("remote_id", remoteId)).fetch()
		return records.at(0) || null
	}

	/** Get all unsynced inspections */
	async getUnsynced(): Promise<Inspection[]> {
		return await this.collection
			.query(Q.where("is_synced", false), Q.where("status", Q.oneOf(["submitted", "conflict"])))
			.fetch()
	}

	/** WRITES */

	/** Create new inspection (offline-first) */
	async create(data: CreateInspectionPayload, userId: string): Promise<Inspection> {
		const now = Date.now()

		const inspection = await database.write(async () => {
			const newInspection = await this.collection.create((record) => {
				record.templateId = data.templateId
				record.facilityName = data.facilityName
				record.facilityAddress = data.facilityAddress
				record.responses = JSON.parse(JSON.stringify(data.responses))

				record.status = "draft"
				record.version = 1
				record.inspectorId = userId
				record.isSynced = false

				record.createdTs = now
				record.updatedTs = now
				record.lastActionTs = now
			})

			return newInspection
		})

		console.log("📝 Created inspection as draft:", inspection.id)
		return inspection
	}

	/** Update existing inspection & Automatically queues sync if status changes to 'submitted' */
	async update(inspectionId: string, data: UpdateInspectionPayload): Promise<Inspection> {
		const inspection = await this.getById(inspectionId)
		if (!inspection) {
			throw new Error(`Inspection ${inspectionId} not found`)
		}

		const now = Date.now()
		const isFirstSubmission =
			data.status === "submitted" && inspection.status === "draft" && !inspection.remoteId

		const updated = await database.write(async () => {
			const updatedRecord = await inspection.update((record) => {
				if (data.facilityName) record.facilityName = data.facilityName
				if (data.facilityAddress) record.facilityAddress = data.facilityAddress
				if (data.responses) record.responses = JSON.parse(JSON.stringify(data.responses))
				if (data.status) {
					record.status = data.status
					if (data.status === "submitted") {
						record.submittedTs = now
					}
				}
				record.updatedTs = now
				// version increment only after successful sync
			})

			// queue syncing operation if submitting
			if (isFirstSubmission) {
				console.log("🆕 First submission, queueing CREATE_INSPECTION")
				await this.queueSyncOperation(updatedRecord, "CREATE_INSPECTION")
			} else if (data.status === "submitted" && inspection.remoteId) {
				console.log("🔄 Updating existing inspection, queueing UPDATE_INSPECTION")
				await this.queueSyncOperation(updatedRecord, "UPDATE_INSPECTION")
			}

			return updatedRecord
		})

		return updated
	}

	/** Mark inspection as synced */
	async markSynced(inspectionId: string, remoteId: string, serverVersion: number): Promise<void> {
		const inspection = await this.getById(inspectionId)
		if (!inspection) return

		await database.write(async () => {
			await inspection.update((record) => {
				record.remoteId = remoteId
				record.isSynced = true
				record.syncedTs = Date.now()
				record.version = serverVersion
				record.status = "synced"
			})
		})

		console.log(`✅ Marked inspection ${inspectionId} as synced with remote_id ${remoteId}`)
	}

	/** Mark inspection as having sync error */
	async markSyncError(inspectionId: string, error: string): Promise<void> {
		const inspection = await this.getById(inspectionId)
		if (!inspection) {
			console.warn(`markSyncError: inspection ${inspectionId} not found`)
			return
		}

		try {
			await database.write(async () => {
				await inspection.update((record) => {
					record.syncError = error
					record.isSynced = false
				})
			})
		} catch (err: any) {
			console.error(`markSyncError failed for ${inspectionId}:`, err, err?.stack)
			console.error("inspection raw:", (inspection as any)?._raw)
			throw err
		}
	}

	/** Delete inspection (local only for now) */
	async delete(inspectionId: string): Promise<void> {
		const inspection = await this.getById(inspectionId)
		if (!inspection) return

		await database.write(async () => {
			await inspection.markAsDeleted()
		})
	}

	/** SYNC QUEUES */

	/** Queue a sync operation */
	private async queueSyncOperation(
		inspection: Inspection,
		operationType: "CREATE_INSPECTION" | "UPDATE_INSPECTION"
	): Promise<void> {
		const idempotencyKey = uuid4()

		await this.syncCollection.create((record) => {
			record.operationType = operationType
			record.entityId = inspection.id
			record.entityType = "inspection"
			record.idempotencyKey = idempotencyKey
			record.payload = JSON.stringify({
				remoteId: inspection.remoteId,
				templateId: inspection.templateId,
				facilityName: inspection.facilityName,
				facilityAddress: inspection.facilityAddress,
				responses: inspection.responses,
				status: inspection.status,
				version: inspection.version,
			})
			record.status = "pending"
			record.retryCount = 0
			record.maxRetries = 5
		})

		console.log(`✅ Queued ${operationType} for inspection ${inspection.id}`)
	}

	/** Get inspection statistics on sync status */
	async getSyncStats(): Promise<{
		total: number
		synced: number
		pending: number
		conflicts: number
	}> {
		const total = await this.collection.query().fetchCount()
		const synced = await this.collection.query(Q.where("is_synced", true)).fetchCount()
		const pending = await this.collection
			.query(Q.where("is_synced", false), Q.where("status", "submitted"))
			.fetchCount()
		const conflicts = await this.collection.query(Q.where("status", "conflict")).fetchCount()

		return { total, synced, pending, conflicts }
	}
}

export default new InspectionRepository()
