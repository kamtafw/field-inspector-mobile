// Data access layer: abstraction over WatermelonDB

import database from ".."
import Inspection, { InspectionResponse } from "../models/Inspection"
import { v4 as uuid4 } from "uuid"
import { Q } from "@nozbe/watermelondb"

export interface CreateInspectionInput {
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
	// private syncCollection = database.get<SyncOperation>('sync_operation')

	// Create new inspection (offline-first) & queues sync operation in background
	async create(input: CreateInspectionInput, userId: string): Promise<Inspection> {
		const inspection = await database.write(async () => {
			const newInspection = await this.collection.create((record) => {
				record.templateId = input.templateId
				record.facilityName = input.facilityName
				record.facilityAddress = input.facilityAddress
				record.responses = input.responses
				record.status = "draft"
				record.version = 1
				record.inspectorId = userId
				record.isSynced = false
			})

			return newInspection
		})

		return inspection
	}

	// Update existing inspection & Automatically queues sync if status changes to 'submitted'
	async update(inspectionId: string, input: UpdateInspectionInput): Promise<Inspection> {
		const inspection = await this.findById(inspectionId)
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
					// if (input.status === 'submitted') record.submittedAt = new Date()
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

	// Find inspection by local ID
	async findById(id: string): Promise<Inspection | null> {
		try {
			return await this.collection.find(id)
		} catch {
			return null
		}
	}

	// Find inspection by remote ID
	async findByRemoteId(remoteId: string): Promise<Inspection | null> {
		const records = await this.collection.query(Q.where("remote_id", remoteId)).fetch()
		return records.at(0) || null
	}

	// Get all inspections for a user
	async findAll(userId: string): Promise<Inspection[]> {
		// return await this.collection
		// 	.query(Q.where("inspector_id", userId), Q.sortBy("created_at", Q.desc))
		// 	.fetch()
		return await this.collection.query().fetch()
	}

	// Delete inspection (local only)
	async delete(inspectionId: string): Promise<void> {
		const inspection = await this.findById(inspectionId)
		if (!inspection) return

		await database.write(async () => {
			await inspection.markAsDeleted()
		})
	}
}

export default new InspectionRepository()
