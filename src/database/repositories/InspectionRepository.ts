import database from ".."
import Inspection, { InspectionResponse } from "../models/Inspection"
import { v4 as uuid4 } from "uuid"
import { Q } from "@nozbe/watermelondb"
import SyncOperation from "../models/SyncOperations"

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
	responses: InspectionResponse
}

export interface UpdateInspectionInput {
	facilityName?: string
	facilityAddress?: string
	responses?: InspectionResponse
	status?: "draft" | "submitted"
}

class InspectionRepository {
	collection = database.get<Inspection>("inspections")
	private syncCollection = database.get<SyncOperation>("sync_operation")

	/* READS */
	async getAll(userId: string): Promise<Inspection[]> {
		// Get all inspections for a user
		return await this.collection
			.query(Q.where("inspector_id", userId), Q.sortBy("created_at", Q.desc))
			.fetch()
	}

	async getById(id: string): Promise<Inspection | null> {
		// Find inspection by local ID
		try {
			return await this.collection.find(id)
		} catch {
			return null
		}
	}

	async getByRemoteId(remoteId: string): Promise<Inspection | null> {
		// Find inspection by remote ID (server UUID)
		const records = await this.collection.query(Q.where("remote_id", remoteId)).fetch()
		return records.at(0) || null
	}

	async getUnsynced(): Promise<Inspection[]> {
		// Get all unsynced inspections
		return await this.collection
			.query(Q.where("is_synced", false), Q.where("status", Q.oneOf(["draft", "conflict"])))
			.fetch()
	}

	/* WRITES */

	// Create new inspection (offline-first) & queues sync operation in background
	async create(data: CreateInspectionPayload, userId: string): Promise<Inspection> {
		const now = Date.now()

		const inspection = await database.write(async () => {
			const newInspection = await this.collection.create((record) => {
				record.templateId = data.templateId
				record.facilityName = data.facilityName
				record.facilityAddress = data.facilityAddress
				record.responses = data.responses

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

		return inspection
	}

	// Update existing inspection & Automatically queues sync if status changes to 'submitted'
	async update(inspectionId: string, input: UpdateInspectionInput): Promise<Inspection> {
		const inspection = await this.getById(inspectionId)
		if (!inspection) {
			throw new Error(`Inspection ${inspectionId} not found`)
		}

		// const shouldQueueSync = input.status === "submitted" && inspection.status === "draft"

		const updated = await database.write(async () => {
			const updatedRecord = await inspection.update((record) => {
				if (input.facilityName) record.facilityName = input.facilityName
				// if (input.facilityAddress) record.facilityAddress = input.facilityAddress
				// if (input.responses) record.responses = input.responses
				if (input.status) {
					record.status = input.status
					// if (input.status === 'submitted') record.submittedAt = Date.now()
				}
				// version increment only after successful sync
			})

			// queue syncing operation if submitting
			// if (shouldQueueSync) {
			// 	await this.queueSyncOperation(updatedRecord, "UPDATE_INSPECTION")
			// }

			return updatedRecord
		})

		return updated
	}

	async markSynced(inspectionId: string, remoteId: string, serverVersion: number): Promise<void> {
		// Mark inspection as synced
		const inspection = await this.getById(inspectionId)
		if (!inspection) return

		await database.write(async () => {
			await inspection.update((record) => {
				record.remoteId = remoteId
				record.isSynced = true
				record.syncedTs = Date.now()
				record.version = serverVersion
				record.status = "synced"
				record.syncError = undefined
			})
		})
	}

	async markSyncError(inspectionId: string, error: string): Promise<void> {
		// Mark inspection as having sync error
		const inspection = await this.getById(inspectionId)
		if (!inspection) return

		await database.write(async () => {
			await inspection.update((record) => {
				record.syncError = error
				record.isSynced = false
			})
		})
	}

	async delete(inspectionId: string): Promise<void> {
		// Delete inspection (local only for now)
		const inspection = await this.getById(inspectionId)
		if (!inspection) return

		await database.write(async () => {
			await inspection.markAsDeleted()
		})
	}

	private async queueSyncOperation(
		inspection: Inspection,
		operationType: "CREATE_INSPECTION" | "UPDATE_INSPECTION"
	): Promise<void> {
		// Queue a sync operation
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
		})
	}
}

export default new InspectionRepository()
