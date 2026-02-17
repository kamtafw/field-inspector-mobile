import database from "@/src/database"
import InspectionsAPI, { InspectionResponseDTO } from "../api/inspections.api"
import NetworkMonitor from "../network/NetworkMonitor"
import InspectionRepository from "@/src/database/repositories/InspectionRepository"
import TemplateValidation from "../template/TemplateValidation"

/**
 * Service for syncing inspections DOWN from server to local database
 * This is separate from SyncEngine which syncs UP from local database to server
 */
class InspectionSyncService {
	/**
	 * Fetch all inspections from server and save to local database
	 * Called after login to restore user's inspections
	 */
	async fetchInspectionsFromServer(): Promise<void> {
		if (!NetworkMonitor.isOnline()) {
			console.log("📴 Offline, skipping inspection fetch")
			return
		}

		try {
			console.log("📥 Fetching inspections from server...")

			// fetch all inspections (paginated)
			let page = 1
			let hasMore = true
			let totalFetched = 0

			while (hasMore) {
				const response = await InspectionsAPI.getAll(page, 50)

				console.log(`📥 Fetched page ${page} of inspections from server...`)

				if (response.results.length > 0) {
					console.log(`Saving ${response.results.length} inspections to local DB...`)
					await this.saveInspectionsLocally(response.results)
					totalFetched += response.results.length
				}

				hasMore = response.next !== null
				page++
			}

			console.log(`✅ Fetched ${totalFetched} inspections from server`)
		} catch (err) {
			console.error("❌ Failed to fetch inspections from server:", err)
			throw err
		}
	}

	/**
	 * Save server inspections to local database
	 * Uses upsert logic: create if doesn't exist, update if exists
	 */
	private async saveInspectionsLocally(serverInspections: InspectionResponseDTO[]): Promise<void> {
		await database.write(async () => {
			for (const serverInspection of serverInspections) {
				try {
					// skip inspections without a template_id
					if (!serverInspection.template_id) {
						console.warn(`⚠️ Inspection ${serverInspection.id} has no template_id, skipping`)
						continue
					}

					// check if inspection exists locally
					const existingInspection = await InspectionRepository.getByRemoteId(serverInspection.id)

					// validate template
					const { template } = await TemplateValidation.validateTemplate(
						serverInspection.template_id,
					)

					if (!template || !template.remoteId) {
						console.warn(`Template ${serverInspection.template_id} not found, skipping inspection`)
						continue
					}

					console.log(`About to save ${serverInspection.id} to local DB`)

					if (existingInspection) {
						// update existing inspection if server version is newer
						if (serverInspection.version > existingInspection.version) {
							await existingInspection.update((record) => {
								record.remoteId = serverInspection.id
								record.templateId = template.remoteId!
								record.facilityName = serverInspection.facility_name
								record.facilityAddress = serverInspection.facility_address
								record.responses = serverInspection.responses
								record.status = this.mapServerStatus(serverInspection.status)
								record.version = serverInspection.version
								record.isSynced = true
								record.syncedTs = Date.now()
								record.submittedTs = serverInspection.submitted_at
									? Date.parse(serverInspection.submitted_at)
									: undefined
							})

							console.log(`✅ Updated inspection ${existingInspection.id} from server`)
						}
					} else {
						// create new local inspection from server data
						await InspectionRepository.collection.create((record) => {
							record.remoteId = serverInspection.id
							record.templateId = template.remoteId!
							record.inspectorId = String(serverInspection.inspector.id)
							record.facilityName = serverInspection.facility_name
							record.facilityAddress = serverInspection.facility_address
							record.responses = serverInspection.responses
							record.status = this.mapServerStatus(serverInspection.status)
							record.version = serverInspection.version
							record.isSynced = true
							record.syncedTs = Date.now()
							record.createdTs = Date.parse(serverInspection.created_at)
							record.updatedTs = Date.parse(serverInspection.updated_at)
							record.lastActionTs = Date.parse(serverInspection.updated_at)
							record.submittedTs = serverInspection.submitted_at
								? Date.parse(serverInspection.submitted_at)
								: undefined
						})

						console.log(`✅ Created local inspection from server: ${serverInspection.id}`)
					}
				} catch (err) {
					console.error(`Failed to save inspection ${serverInspection.id}:`, err)
					// continue with next inspection
				}
			}
		})
	}

	/**
	 * Map server status to local status
	 */
	private mapServerStatus(
		serverStatus: string,
	): "draft" | "submitted" | "synced" | "conflict" | "sync_failed" {
		switch (serverStatus) {
			case "draft":
				return "draft"
			case "submitted":
			case "approved":
			case "rejected":
				return "synced" // server has processed it
			default:
				return "synced"
		}
	}

	/**
	 * Fetch a single inspection from server by ID
	 */
	async fetchInspectionById(remoteId: string): Promise<void> {
		if (!NetworkMonitor.isOnline()) {
			console.log("📴 Offline, skipping inspection fetch")
			return
		}

		try {
			console.log(`📥 Fetching inspection ${remoteId} from server...`)

			const serverInspection = await InspectionsAPI.getById(remoteId)
			await this.saveInspectionsLocally([serverInspection])

			console.log(`✅ Fetched inspection ${remoteId} from server`)
		} catch (err) {
			console.error(`❌ Failed to fetch inspection ${remoteId} from server:`, err)
			throw err
		}
	}
}

export default new InspectionSyncService()
