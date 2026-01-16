import NetInfo from "@react-native-community/netinfo"
import ConflictDetector from "./ConflictDetector"
import SyncOperation from "@/src/database/models/SyncOperation"
import InspectionsAPI, { ConflictResponse } from "../api/inspections.api"
import ConflictRepository from "@/src/database/repositories/ConflictRepository"
import InspectionRepository from "@/src/database/repositories/InspectionRepository"
import SyncRepository from "@/src/database/repositories/SyncRepository"

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
		NetInfo.addEventListener((state) => {
			console.log("🌐 Network state changed:", state.isConnected)

			if (state.isConnected && !this.isProcessing) {
				console.log("✅ Network available, triggering sync...")
				this.process()
			}
		})

		const netState = await NetInfo.fetch()
		if (netState.isConnected) {
			console.log("✅ Online at startup, processing queue...")
			await this.process()
		} else {
			console.log("📴 Offline at startup, waiting for network...")
		}
	}

	/** Process all pending sync operations */
	async process(): Promise<void> {
		if (this.isProcessing) {
			console.log("⏳ Already processing, skipping...")
			return
		}

		const netState = await NetInfo.fetch()
		if (!netState.isConnected) {
			console.log("📴 Offline, cannot process sync operations")
			return
		}

		this.isProcessing = true
		this.updateStatus("syncing")

		try {
			console.log("🔄 SyncEngine: Starting to process queue...")

			// get all pending operations
			const operations = await SyncRepository.getPendingOperations()

			if (operations.length === 0) {
				console.log("✅ No pending operations")
				this.updateStatus("idle")
				return
			}

			if (operations.length >= 3) {
				console.log(`📦 Using BATCH sync for ${operations.length} operations`)
				await this.processBatch(operations)
			} else {
				console.log(`🔄 Using INDIVIDUAL sync for ${operations.length} operations`)
				await this.processIndividual(operations)
			}

			this.updateStatus("idle")
		} catch (err) {
			console.error(`❌ SyncEngine: Fatal error during sync:`, err)
			this.updateStatus("error")
		} finally {
			this.isProcessing = false

			// notify listeners with updated stats
			const stats = await SyncRepository.getQueueStats()
			this.notifyListeners(this.status, stats)
		}
	}

	/** Process operations individually - for small batches (1-2 operations) */
	private async processIndividual(operations: SyncOperation[]): Promise<void> {
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

		console.log(`✅ Individual sync: ${successCount} succeeded, ${failCount} failed`)
	}

	/** Process operations in batch - for larger batches (3+ operations) */
	private async processBatch(operations: SyncOperation[]): Promise<void> {
		try {
			// prepare batch request
			const batchOperations = operations.map((op) => {
				const data = JSON.parse(op.payload)

				return {
					operation_type: op.operationType,
					idempotency_key: op.idempotencyKey,
					data: {
						id: data.remoteId,
						template_id: data.templateId,
						facility_name: data.facilityName,
						facility_address: data.facilityAddress,
						responses: data.responses,
						status: data.status,
						version: data.version,
					},
				}
			})

			const results = await InspectionsAPI.batchSync(batchOperations)

			let successCount = 0
			let failCount = 0
			let conflictCount = 0

			const tasks: Promise<void>[] = []

			for (let i = 0; i < results.length; i++) {
				const result = results[i]
				const operation = operations[i]

				// check for conflicts (409)
				if (!result.success && result.error === "conflict" && result.data) {
					conflictCount++
					console.log(`⚠️ Conflict detected in batch for operation ${operation.id}`)

					tasks.push(this.handleConflict(operation, result.conflict_data))
					continue
				}

				if (!result.success) {
					failCount++
					tasks.push(SyncRepository.markFailed(operation.id, result.error ?? "Unknown error"))
					continue
				}

				if (!result.data?.id) {
					failCount++
					tasks.push(SyncRepository.markFailed(operation.id, "Missing server entity ID"))
					continue
				}

				successCount++
				tasks.push(
					SyncRepository.markCompleted(operation.id),
					InspectionRepository.markSynced(
						operation.entityId,
						result.data.id,
						result.data.version ?? 1
					)
				)
			}

			await Promise.all(tasks)

			console.log(
				`✅ Batch sync completed: ${successCount} succeeded, ${failCount} failed, ${conflictCount} conflicts.`
			)
		} catch (err: any) {
			console.error("❌ Batch sync failed:", err)

			for (const operation of operations) {
				await SyncRepository.markFailed(operation.id, "Batch sync failed:" + err.message)
			}
		}
	}

	/** Process a single sync operation */
	async processOperation(operation: SyncOperation): Promise<void> {
		console.log(`🔄 Processing operation: ${operation.operationType} (${operation.id})`)

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
				console.log("⚠️ 409 Conflict detected, handling...")
				await this.handleConflict(operation, err.response.data)
				return
			}

			// check retry limit
			if (operation.retryCount >= operation.maxRetries) {
				await SyncRepository.markFailed(operation.id, "Max retries exceeded")
				return
			}

			// mark other errors as failed and schedule a retry
			await SyncRepository.markFailed(operation.id, err.message)
			throw err
		}
	}

	/** Sync CREATE_INSPECTION operation */
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

		await InspectionRepository.markSynced(operation.entityId, response.id, response.version)
		await SyncRepository.markCompleted(operation.id)
		console.log("✅ CREATE synced, remote_id:", response.id)
	}

	/** Sync UPDATE_INSPECTION operation */
	private async syncUpdateInspection(operation: SyncOperation, payload: any): Promise<void> {
		console.log("🔄 Syncing UPDATE_INSPECTION:", operation.entityId)

		const remoteId = payload.remoteId

		if (!remoteId) {
			throw new Error(
				`Cannot update inspection ${operation.entityId}: no remote_id. ` +
					`Inspection must be created first. Payload: ${JSON.stringify(payload)}`
			)
		}

		const response = await InspectionsAPI.update(
			remoteId,
			{
				facility_name: payload.facilityName,
				facility_address: payload.facilityAddress,
				responses: payload.responses,
				status: payload.status,
				version: payload.version,
			},
			operation.idempotencyKey
		)

		if ("error" in response && response.error === "conflict") {
			throw { response: { status: 409, data: response } }
		}

		await InspectionRepository.markSynced(operation.entityId, response.id, response.version)
		await SyncRepository.markCompleted(operation.id)
	}

	/** Handle 409 conflict response */
	private async handleConflict(
		operation: SyncOperation,
		conflictData: ConflictResponse
	): Promise<void> {
		console.log("⚠️ Conflict detected on inspection:", operation.entityId)

		const clientData = JSON.parse(operation.payload)
		const serverData = {
			remoteId: conflictData.server_data.id,
			templateId: conflictData.server_data.template_id,
			facilityName: conflictData.server_data.facility_name,
			facilityAddress: conflictData.server_data.facility_address,
			responses: conflictData.server_data.response,
			status: conflictData.server_data.status,
			version: conflictData.server_data.version,
		}

		// detect conflict fields
		const conflictFields = ConflictDetector.detectConflicts(clientData, serverData)

		console.log("📋 Conflict fields:", conflictFields)

		try {
			await ConflictRepository.create({
				inspectionId: operation.entityId,
				clientVersion: conflictData.client_version,
				serverVersion: conflictData.server_version,
				clientData: clientData,
				serverData: serverData,
				conflictFields,
			})

			console.log("💾 Conflict record created")

			// mark inspection as conflicted
			await InspectionRepository.markConflict(operation.entityId)

			// mark operation as completed (conflict resolution is a separate workflow)
			await SyncRepository.markCompleted(operation.id)

			console.log("✅ Conflict handling complete")
		} catch (err) {
			console.error("❌ Failed to create conflict record:", err)
			throw err
		}
	}

	/** Get sync operations queue statistics */
	async getStats(): Promise<SyncStats> {
		return await SyncRepository.getQueueStats()
	}

	/** Get current sync status */
	getStatus(): SyncStatus {
		return this.status
	}

	/** Subscribe to sync status changes */
	addListener(callback: (status: SyncStatus, stats?: SyncStats) => void) {
		this.listeners.push(callback)
	}

	/** Unsubscribe from sync status changes */
	removeListener(callback: (status: SyncStatus, stats?: SyncStats) => void) {
		this.listeners = this.listeners.filter((cb) => cb !== callback)
	}

	/** Update status & notify listeners */
	private updateStatus(status: SyncStatus) {
		this.status = status
	}

	/** Notify all listeners */
	private notifyListeners(status: SyncStatus, stats?: SyncStats) {
		this.listeners.forEach((callback) => callback(status, stats))
	}

	/** Force sync now (manual trigger) */
	async syncNow(): Promise<void> {
		// TODO: throw error if no connection

		return this.process()
	}
}

export default new SyncEngine()
