import * as SecureStore from "expo-secure-store"
import NetInfo from "@react-native-community/netinfo"
import SyncOperation from "@/src/database/models/SyncOperation"
import InspectionsAPI, { ConflictResponse } from "../api/inspections.api"
import ConflictDetector from "./ConflictDetector"
import ConflictRepository from "@/src/database/repositories/ConflictRepository"
import InspectionRepository from "@/src/database/repositories/InspectionRepository"
import SyncRepository from "@/src/database/repositories/SyncRepository"
import PhotoUploadService from "../photo/PhotoUploadService"
import ErrorAlert from "@/src/components/ui/ErrorAlert"
import { NetworkResilience } from "../network/NetworkResilience"
import { Alert } from "react-native"

export type SyncStatus = "idle" | "syncing" | "error"

export interface SyncStats {
	pending: number
	inProgress: number
	failed: number
	completed: number
	syncedCount?: number
	totalToSync?: number
}

class SyncEngine {
	private isProcessing = false
	private status: SyncStatus = "idle"
	private syncProgress = { completed: 0, total: 0 }
	private listeners: Array<(status: SyncStatus, stats?: SyncStats) => void> = []
	private retryTimeoutId?: NodeJS.Timeout
	private networkUnsubscribe?: () => void

	async initialize() {
		console.log("🔄 SyncEngine: Initializing...")

		// listen for network changes
		this.networkUnsubscribe = NetInfo.addEventListener((state) => {
			console.log("🌐 Network state changed:", state.isConnected)

			if (state.isConnected && !this.isProcessing) {
				console.log("✅ Network available, triggering sync...")
				this.processQueue()
			}
		})

		const netState = await NetInfo.fetch()
		if (netState.isConnected) {
			console.log("✅ Online at startup, processing queue...")
			await this.processQueue()
		}
	}

	/** Clean up on app close */
	cleanup(): void {
		if (this.networkUnsubscribe) {
			this.networkUnsubscribe()
		}
		if (this.retryTimeoutId) {
			clearTimeout(this.retryTimeoutId)
		}
	}

	/** Process all pending sync operations */
	async processQueue(): Promise<void> {
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
			const operations = await SyncRepository.getPendingOperations()

			if (operations.length === 0) {
				this.updateStatus("idle")
				return
			}

			this.syncProgress = { completed: 0, total: operations.length }
			this.notifyListeners(this.status, await this.getStats())

			await this.processIndividual(operations)

			this.updateStatus("idle")

			// schedule retry if there are still failed operations
			await this.scheduleRetry()

			// trigger photo uploads after sync
			PhotoUploadService.processQueue()
		} catch (err) {
			console.error(`❌ SyncEngine: Fatal error during sync:`, err)
			this.updateStatus("error")

			await this.scheduleRetry()
		} finally {
			this.isProcessing = false

			// notify listeners with updated stats
			const stats = await SyncRepository.getQueueStats()
			this.notifyListeners(this.status, stats)
		}
	}

	/** Schedule retry for failed operations */
	private async scheduleRetry(): Promise<void> {
		const stats = await SyncRepository.getQueueStats()

		if (stats.failed === 0) {
			return
		}

		if (this.retryTimeoutId) {
			clearTimeout(this.retryTimeoutId)
		}

		const failedOps = await SyncRepository.collection.query().fetch()
		const failedWithRetry = failedOps.filter(
			(op) => op.status === "failed" && op.retryCount < op.maxRetries && op.nextRetryTs,
		)

		if (failedWithRetry.length === 0) {
			console.log("No retryable operations")
			return
		}

		const earliestRetry = Math.min(...failedWithRetry.map((op) => op.nextRetryTs!))
		const now = Date.now()
		const delayMs = Math.max(0, earliestRetry - now)

		console.log(
			`⏰ Scheduling retry in ${Math.round(delayMs / 1000)}s for ${failedWithRetry.length} operations`,
		)

		this.retryTimeoutId = setTimeout(this.processQueue, delayMs)
	}

	/** Process operations individually - for small batches (1-2 operations) */
	private async processIndividual(operations: SyncOperation[]): Promise<void> {
		for (const operation of operations) {
			await this.processOperation(operation)

			this.syncProgress.completed++
			this.notifyListeners(this.status, await this.getStats())
		}

		if (this.syncProgress.completed > 0) {
			await SecureStore.setItemAsync("lastSyncTimestamp", Date.now().toString())
		}
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
						result.data.version ?? 1,
					),
				)
			}

			await Promise.all(tasks)

			console.log(
				`✅ Batch sync completed: ${successCount} succeeded, ${failCount} failed, ${conflictCount} conflicts.`,
			)
		} catch (err: any) {
			console.error("❌ Batch sync failed:", err)

			for (const operation of operations) {
				await SyncRepository.markFailed(operation.id, "Batch sync failed:" + err.message)
			}

			ErrorAlert.show(err)
		}
	}

	/** Process a single sync operation */
	async processOperation(operation: SyncOperation): Promise<void> {
		console.log(`🔄 Processing operation: ${operation.operationType} (${operation.id})`)

		let rollbackData: any = null
		if (operation.operationType === "UPDATE_INSPECTION") {
			rollbackData = await InspectionRepository.createRollbackPoint(operation.entityId)
		}

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

			if (err.response?.status !== 409 && rollbackData) {
				await InspectionRepository.rollbackInspection(operation.entityId, rollbackData)

				Alert.alert(
					"Sync Failed",
					"Your changes couldn't be synced. We've restored the previous version.",
					[{ text: "OK" }],
				)
			}

			// handle conflict (409)
			if (err.response?.status === 409) {
				await this.handleConflict(operation, err.response.data)
				return
			}

			if (operation.retryCount >= operation.maxRetries) {
				await InspectionRepository.markSyncError(
					operation.entityId,
					"Sync failed after maximum retries. Your changes are saved locally.",
				)
				return
			}

			await SyncRepository.markFailed(operation.id, err.message)
			throw err
		}
	}

	/** Sync CREATE_INSPECTION operation */
	private async syncCreateInspection(operation: SyncOperation, payload: any): Promise<void> {
		const data = {
			template_id: payload.templateId,
			facility_name: payload.facilityName,
			facility_address: payload.facilityAddress,
			responses: payload.responses,
			status: payload.status,
			version: payload.version,
		}

		const response = await NetworkResilience.withRetry(
			() => InspectionsAPI.create(data, operation.idempotencyKey),
			{ maxAttempts: 3 },
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
					`Inspection must be created first. Payload: ${JSON.stringify(payload)}`,
			)
		}

		const data = {
			facility_name: payload.facilityName,
			facility_address: payload.facilityAddress,
			responses: payload.responses,
			status: payload.status,
			version: payload.version,
		}

		const response = await NetworkResilience.withRetry(
			() => InspectionsAPI.update(remoteId, data, operation.idempotencyKey),
			{ maxAttempts: 3 },
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
		conflictData: ConflictResponse,
	): Promise<void> {
		const clientData = JSON.parse(operation.payload)
		const serverData = {
			remoteId: conflictData.server_data.id,
			templateId: conflictData.server_data.template_id,
			facilityName: conflictData.server_data.facility_name,
			facilityAddress: conflictData.server_data.facility_address,
			responses: conflictData.server_data.responses,
			status: conflictData.server_data.status,
			version: conflictData.server_data.version,
		}

		const conflictFields = ConflictDetector.detectConflicts(clientData, serverData)

		console.log("📋 Conflict fields:", conflictFields)

		// TODO: handle conflicts on same inspection - i.e. when there's a new conflict on same inspection

		try {
			await ConflictRepository.create({
				inspectionId: operation.entityId,
				clientVersion: conflictData.client_version,
				serverVersion: conflictData.server_version,
				clientData: clientData,
				serverData: serverData,
				conflictFields,
				serverUpdatedBy: {
					name: conflictData.server_data.updated_by.name,
					email: conflictData.server_data.updated_by.email,
				},
				serverUpdatedTs: Date.parse(conflictData.server_data.updated_at),
			})

			await InspectionRepository.markConflict(operation.entityId)
			await SyncRepository.markCompleted(operation.id)

			console.log("✅ Conflict handling complete")
		} catch (err) {
			console.error("❌ Failed to create conflict record:", err)
			throw err
		}
	}

	/** Get sync stats */
	async getStats(): Promise<SyncStats> {
		const baseStats = await SyncRepository.getQueueStats()
		return {
			...baseStats,
			syncedCount: this.syncProgress.completed,
			totalToSync: this.syncProgress.total,
		}
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
		return this.processQueue()
	}
}

export default new SyncEngine()
