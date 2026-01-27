import database from "@/src/database"
import InspectionRepository from "@/src/database/repositories/InspectionRepository"
import PhotoRepository from "@/src/database/repositories/PhotoRepository"
import SyncRepository from "@/src/database/repositories/SyncRepository"
import ConflictRepository from "@/src/database/repositories/ConflictRepository"

interface IntegrityReport {
	timestamp: number
	issues: IntegrityIssue[]
	fixedCount: number
	totalChecks: number
}

interface IntegrityIssue {
	type: string
	severity: "low" | "medium" | "high"
	description: string
	affectedRecords: string[]
	autoFixed: boolean
}

export class DataIntegrityService {
	/**
	 * Run comprehensive data integrity check
	 * Call this periodically (e.g., on app start or weekly)
	 */
	static async runIntegrityCheck(autoFix: boolean = true): Promise<IntegrityReport> {
		console.log("🔍 Starting data integrity check...")
		const startTime = Date.now()

		const issues: IntegrityIssue[] = []
		let fixedCount = 0
		let totalChecks = 0

		// check 1: orphaned sync operations
		totalChecks++
		const syncIssue = await this.checkOrphanedSyncOperations(autoFix)
		if (syncIssue) {
			issues.push(syncIssue)
			if (syncIssue.autoFixed) fixedCount++
		}

		// check 2: orphaned photos
		totalChecks++
		const photoIssue = await this.checkOrphanedPhotos(autoFix)
		if (photoIssue) {
			issues.push(photoIssue)
			if (photoIssue.autoFixed) fixedCount++
		}

		// check 3: invalid inspection states
		totalChecks++
		const stateIssue = await this.checkInvalidInspectionStates(autoFix)
		if (stateIssue) {
			issues.push(stateIssue)
			if (stateIssue.autoFixed) fixedCount++
		}

		// check 4: resolved conflicts still marked as conflicted
		totalChecks++
		const conflictIssue = await this.checkStaleConflicts(autoFix)
		if (conflictIssue) {
			issues.push(conflictIssue)
			if (conflictIssue.autoFixed) fixedCount++
		}

		// check 5: missing remote IDs for synced inspections
		totalChecks++
		const remoteIdIssue = await this.checkMissingRemoteIds(autoFix)
		if (remoteIdIssue) {
			issues.push(remoteIdIssue)
			if (remoteIdIssue.autoFixed) fixedCount++
		}

		// check 6: duplicate sync operations
		totalChecks++
		const duplicateOps = await this.checkDuplicateSyncOperations(autoFix)
		if (duplicateOps) {
			issues.push(duplicateOps)
			if (duplicateOps.autoFixed) fixedCount++
		}

		const duration = Date.now() - startTime
		console.log(`✅ Integrity check complete in ${duration}ms`)
		console.log(`   Found ${issues.length} issues, fixed ${fixedCount}`)

		return {
			timestamp: Date.now(),
			issues,
			fixedCount,
			totalChecks,
		}
	}

	/**
	 * Check for sync operations referencing deleted inspections
	 */
	private static async checkOrphanedSyncOperations(
		autoFix: boolean,
	): Promise<IntegrityIssue | null> {
		try {
			const allOps = await SyncRepository.collection.query().fetch()
			const orphanedOps: string[] = []

			for (const op of allOps) {
				try {
					const inspection = await InspectionRepository.getById(op.entityId)
					if (!inspection) {
						orphanedOps.push(op.id)
					}
				} catch {
					orphanedOps.push(op.id)
				}
			}

			if (orphanedOps.length === 0) return null

			if (autoFix) {
				await database.write(async () => {
					for (const opId of orphanedOps) {
						const op = await SyncRepository.collection.find(opId)
						await op.markAsDeleted()
					}
				})

				return {
					type: "orphaned_sync_operations",
					severity: "low",
					description: `Found and deleted ${orphanedOps.length} sync operations for deleted inspections`,
					affectedRecords: orphanedOps,
					autoFixed: true,
				}
			}

			return {
				type: "orphaned_sync_operations",
				severity: "low",
				description: `Found ${orphanedOps.length} sync operations for deleted inspections`,
				affectedRecords: orphanedOps,
				autoFixed: false,
			}
		} catch (err) {
			console.error("Error checking orphaned sync ops:", err)
			return null
		}
	}

	/**
	 * Check for photos referencing deleted inspections
	 */
	private static async checkOrphanedPhotos(autoFix: boolean): Promise<IntegrityIssue | null> {
		try {
			const allPhotos = await PhotoRepository.collection.query().fetch()
			const orphanedPhotos: string[] = []

			for (const photo of allPhotos) {
				try {
					const inspection = await InspectionRepository.getById(photo.inspectionId)
					if (!inspection) {
						orphanedPhotos.push(photo.id)
					}
				} catch {
					orphanedPhotos.push(photo.id)
				}
			}

			if (orphanedPhotos.length === 0) return null

			if (autoFix) {
				for (const photoId of orphanedPhotos) {
					await PhotoRepository.delete(photoId)
				}

				return {
					type: "orphaned_photos",
					severity: "medium",
					description: `Found and deleted ${orphanedPhotos.length} photos for deleted inspections`,
					affectedRecords: orphanedPhotos,
					autoFixed: true,
				}
			}

			return {
				type: "orphaned_photos",
				severity: "medium",
				description: `Found ${orphanedPhotos.length} photos for deleted inspections`,
				affectedRecords: orphanedPhotos,
				autoFixed: false,
			}
		} catch (err) {
			console.error("Error checking orphaned photos:", err)
			return null
		}
	}

	/**
	 * Check for invalid inspection states
	 * e.g., status="synced" but isSynced=false
	 */
	private static async checkInvalidInspectionStates(
		autoFix: boolean,
	): Promise<IntegrityIssue | null> {
		try {
			const allInspections = await InspectionRepository.collection.query().fetch()
			const invalidStates: string[] = []

			for (const inspection of allInspections) {
				// check: synced status should have isSynced=true and remoteId
				if (inspection.status === "synced") {
					if (!inspection.isSynced || !inspection.remoteId) {
						invalidStates.push(inspection.id)

						if (autoFix) {
							await database.write(async () => {
								await inspection.update((record) => {
									// if has remoteId but not marked synced
									if (record.remoteId && !record.isSynced) {
										record.isSynced = true
									}
									// if no remoteId, change status to submitted
									else if (!record.remoteId) {
										record.status = "submitted"
										record.isSynced = false
									}
								})
							})
						}
					}
				}

				// check: submitted but has remoteId should be synced
				if (inspection.status === "submitted" && inspection.remoteId && inspection.isSynced) {
					invalidStates.push(inspection.id)

					if (autoFix) {
						await database.write(async () => {
							await inspection.update((record) => {
								record.status = "synced"
							})
						})
					}
				}
			}

			if (invalidStates.length === 0) return null

			return {
				type: "invalid_inspection_states",
				severity: "medium",
				description: `Found ${invalidStates.length} inspections with invalid state combinations`,
				affectedRecords: invalidStates,
				autoFixed: autoFix,
			}
		} catch (err) {
			console.error("Error checking inspection states:", err)
			return null
		}
	}

	/**
	 * Check for resolved conflicts where inspection is still marked as conflicted
	 */
	private static async checkStaleConflicts(autoFix: boolean): Promise<IntegrityIssue | null> {
		try {
			const allConflicts = await ConflictRepository.collection.query().fetch()
			const staleConflicts: string[] = []

			for (const conflict of allConflicts) {
				if (conflict.resolved) {
					const inspection = await InspectionRepository.getById(conflict.inspectionId)

					if (inspection && inspection.status === "conflict") {
						staleConflicts.push(inspection.id)

						if (autoFix) {
							await database.write(async () => {
								await inspection.update((record) => {
									record.status = "submitted"
								})
							})
						}
					}
				}
			}

			if (staleConflicts.length === 0) return null

			return {
				type: "stale_conflicts",
				severity: "low",
				description: `Found ${staleConflicts.length} inspections still marked as conflicted after resolution`,
				affectedRecords: staleConflicts,
				autoFixed: autoFix,
			}
		} catch (err) {
			console.error("Error checking stale conflicts:", err)
			return null
		}
	}

	/**
	 * Check for synced inspections without remoteId
	 */
	private static async checkMissingRemoteIds(autoFix: boolean): Promise<IntegrityIssue | null> {
		try {
			const allInspections = await InspectionRepository.collection.query().fetch()
			const missingRemoteIds: string[] = []

			for (const inspection of allInspections) {
				if (inspection.isSynced && !inspection.remoteId) {
					missingRemoteIds.push(inspection.id)

					if (autoFix) {
						await database.write(async () => {
							await inspection.update((record) => {
								record.isSynced = false
								record.status = "submitted"
							})
						})
					}
				}
			}

			if (missingRemoteIds.length === 0) return null

			return {
				type: "missing_remote_ids",
				severity: "high",
				description: `Found ${missingRemoteIds.length} inspections marked as synced without remote IDs`,
				affectedRecords: missingRemoteIds,
				autoFixed: autoFix,
			}
		} catch (err) {
			console.error("Error checking missing remote IDs:", err)
			return null
		}
	}

	/**
	 * Check for duplicate pending sync operations
	 */
	private static async checkDuplicateSyncOperations(
		autoFix: boolean,
	): Promise<IntegrityIssue | null> {
		try {
			const pendingOps = await SyncRepository.getPendingOperations()
			const seenEntities = new Map<string, string>()
			const duplicates: string[] = []

			for (const op of pendingOps) {
				const existing = seenEntities.get(op.entityId)

				if (existing) {
					// keep the newer operation, delete the older one
					duplicates.push(op.id)

					if (autoFix) {
						await database.write(async () => {
							await op.markAsDeleted()
						})
					}
				} else {
					seenEntities.set(op.entityId, op.id)
				}
			}

			if (duplicates.length === 0) return null

			return {
				type: "duplicate_sync_operations",
				severity: "medium",
				description: `Found and removed ${duplicates.length} duplicate sync operations`,
				affectedRecords: duplicates,
				autoFixed: autoFix,
			}
		} catch (err) {
			console.error("Error checking duplicate sync ops:", err)
			return null
		}
	}

	/**
	 * Clean up old completed/resolved records
	 */
	static async cleanupOldRecords(): Promise<void> {
		console.log("🧹 Cleaning up old records...")

		// Clean up old sync operations (7+ days)
		const cleanedOps = await SyncRepository.cleanupOldOperations()
		console.log(`   Removed ${cleanedOps} old sync operations`)

		// Clean up old resolved conflicts (30+ days)
		const cleanedConflicts = await ConflictRepository.cleanupOldConflicts()
		console.log(`   Removed ${cleanedConflicts} old resolved conflicts`)

		console.log("✅ Cleanup complete")
	}
}
