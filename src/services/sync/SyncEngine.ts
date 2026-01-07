import SyncOperation from "@/src/database/models/SyncOperations"
import InspectionRepository from "@/src/database/repositories/InspectionRepository"
import SyncRepository from "@/src/database/repositories/SyncRepository"
import InspectionsAPI from "../api/inspections.api"

export type SyncStatus = "idle" | "syncing" | "error"

export interface SyncStats {
	pending: number
	inProgress: number
	failed: number
	completed: number
}

class SyncEngine {
	private isProcessing = false
	private status: SyncStatus = "idle"
	private listeners: Array<(status: SyncStatus, stats?: SyncStats) => void> = []

	async initialize() {
		console.log("🔄 SyncEngine: Initializing...")

		// listen for network changes

		// check if online and process pending operations
	}

	/**
	 * Process all pending sync operations
	 * TODO: Call automatically when network becomes available
	 */
	async process(): Promise<void> {
		if (this.isProcessing) {
			console.log("⏳ Already processing, skipping...")
			return
		}

		this.isProcessing = true
		this.updateStatus("syncing")

		try {
			console.log("🔄 SyncEngine: Starting to process queue...")

			// get all pending operations
			const operations = await SyncRepository.getPendingOperations()
			console.log(`📋 Found ${operations.length} pending operations`)

			if (operations.length === 0) {
				console.log("✅ No pending operations")
				this.updateStatus("idle")
				return
			}

			// process each operation
			let successCount = 0
			let failCount = 0

			for (const operation of operations) {
				try {
					await this.processOperation(operation)
					successCount++
				} catch (err: any) {
					console.error(`❌ Operation ${operation.id} failed:`, err.message)
					failCount++
				}
			}

			console.log(`✅ Sync complete: ${successCount} succeeded, ${failCount} failed`)
			this.updateStatus("idle")
		} catch (err) {
			console.error(`❌ SyncEngine: Fatal error during sync:`, err)
			this.updateStatus("error")
		} finally {
			this.isProcessing = false

			// TODO: notify listeners with updated stats
			// const stats = await SyncRepository.getQueueStats()
			// this.notifyListeners(this.status, stats)
		}
	}

	/**
	 * Process a single sync operation
	 * @param operation
	 */
	async processOperation(operation: SyncOperation): Promise<void> {
		console.log(`🔄 Processing operation: ${operation.operationType} (${operation.id})`)

		// mark operation in-progress
		await SyncRepository.markInProgress(operation.id)

		try {
			const payload = JSON.parse(operation.payload)

			switch (operation.operationType) {
				case "CREATE_INSPECTION":
					await this.syncCreateInspection(operation, payload)
					break

				case "UPDATE_INSPECTION":
					await this.syncUpdateInspection(operation, payload)
					break

				default:
					throw new Error(`Unknown operation type: ${operation.operationType}`)
			}

			console.log(`✅ Operation completed: ${operation.id}`)
		} catch (err: any) {
			console.error(`❌ Operation failed: ${operation.id}`, err)

			// check if it's a conflict (409) - don't retry, handle specially
			if (err.response?.status === 409) {
				return
			} else {
				// mark other errors as failed and schedule a retry
				await SyncRepository.markFailed(operation.id)
			}

			throw err
		}
	}

	/**
	 * Sync CREATE_INSPECTION operation
	 * @param operation
	 * @param payload
	 */
	private async syncCreateInspection(operation: SyncOperation, payload: any): Promise<void> {
		const response = await InspectionsAPI.create(
			{
				template_id: payload.templateId,
				facility_name: payload.facilityName,
				facility_address: payload.facilityAddress,
				responses: payload.responses,
				status: payload.status,
				version: payload.version,
			},
			operation.idempotencyKey
		)

		// update local inspection with server data
		await InspectionRepository.markSynced(operation.entityId, response.id, response.version)

		// mark operation complete
		await SyncRepository.markCompleted(operation.id)
	}

	/**
	 * Sync UPDATE_INSPECTION operation
	 * @param operation
	 * @param payload
	 */
	private async syncUpdateInspection(operation: SyncOperation, payload: any): Promise<void> {
		const response = await InspectionsAPI.update(
			payload.remoteId || operation.entityId,
			{
				facility_name: payload.facilityName,
				facility_address: payload.facilityAddress,
				responses: payload.responses,
				status: payload.status,
				version: payload.version,
			},
			operation.idempotencyKey
		)

		// check for conflict
		if ("error" in response && response.error === "conflict") {
			throw { response: { status: 409, data: response } }
		}

		// update local inspection
		await InspectionRepository.markSynced(operation.entityId, response.id, response.version)

		// mark operation complete
		await SyncRepository.markCompleted(operation.id)
	}

	// async getStats(): SyncStats {
	// 	/**
	// 	 * Get current sync statistics
	// 	 */
	// 	return await SyncRepository.getQueueStats()
	// }

	getStatus(): SyncStatus {
		// Get current sync status
		return this.status
	}

	addListener(callback: (status: SyncStatus, stats?: SyncStats) => void) {
		// Subscribe to sync status changes
		this.listeners.push(callback)
	}

	removeListener(callback: (status: SyncStatus, stats?: SyncStats) => void) {
		// Unsubscribe from sync status changes
		this.listeners = this.listeners.filter((cb) => cb !== callback)
	}

	private updateStatus(status: SyncStatus) {
		// Update status & notify listeners
		this.status = status
	}

	private notifyListeners(status: SyncStatus, stats?: SyncStats) {
		// Notify all listeners
		this.listeners.forEach((callback) => callback(status, stats))
	}
}

export default new SyncEngine()
