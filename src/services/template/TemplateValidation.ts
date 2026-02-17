import * as SecureStore from "expo-secure-store"
import { Q } from "@nozbe/watermelondb"
import database from "@/src/database"
import NetworkMonitor from "../network/NetworkMonitor"
import InspectionTemplate from "@/src/database/models/InspectionTemplate"
import InspectionsAPI, { InspectionTemplateDTO } from "../api/inspections.api"
import { API_BASE_URL } from "@/src/config"

class TemplateValidationService {
	private collection = database.get<InspectionTemplate>("inspection_templates")
	private templateCache: Map<string, InspectionTemplate> = new Map()

	/**
	 * Validate template exists and is available
	 * Handles both online and offline scenarios
	 */
	async validateTemplate(templateId: string): Promise<{
		isValid: boolean
		isDeleted?: boolean
		template?: InspectionTemplate
		error?: string
	}> {
		console.log(`Check for template with id: ${templateId}`)

		// server re-check when online
		if (NetworkMonitor.isOnline()) {
			try {
				await InspectionsAPI.getTemplateById(templateId)

				// read local record
				const localTemplate =
					(await this.getLocalTemplate(templateId)) ?? (await this.getLocalTemplate(templateId))

				if (localTemplate) {
					this.templateCache.set(templateId, localTemplate)
					return { isValid: true, template: localTemplate }
				}

				// rare: server confirms template exists but it's not in local DB yet (probably cache was cleared after prefetch)
				return { isValid: false, error: "Template data is being refreshed. Please try again in a moment" }
			} catch (err: any) {
				if (err.response?.status === 404) {
					// template was deleted on the backend
					console.warn(`Template ${templateId} deleted on server — purging local copy`)
					await this.purgeLocalTemplate(templateId)
					return { isValid: false, isDeleted: true, error: "This template is no longer available" }
				}
				// network hiccup — fall through to local DB as best-effort fallback
				console.warn("Server check failed, falling back to local:", err.message)
			}
		}

		// offline or server unreachable: use in-memory cache first
		const cached = this.templateCache.get(templateId)
		if (cached) {
			return { isValid: true, template: cached }
		}

		// then local DB
		try {
			const localTemplate = await this.getLocalTemplate(templateId)
			if (localTemplate) {
				this.templateCache.set(templateId, localTemplate)
				return { isValid: true, template: localTemplate }
			}
		} catch (err) {
			console.warn("Error checking local templates:", err)
		}

		return {
			isValid: false,
			error: "Template not available offline. Please connect to download it.",
		}
	}

	/**
	 * Get all available templates
	 * Returns cached or fetches from server
	 */
	async getAvailableTemplates(): Promise<InspectionTemplate[]> {
		const lastETag = await SecureStore.getItemAsync("templatesETag")

		if (NetworkMonitor.isOnline()) {
			try {
				const token = await SecureStore.getItemAsync("accessToken")

				// HEAD request to check ETag
				const headResponse = await fetch(`${API_BASE_URL}/templates/`, {
					method: "HEAD",
					headers: {
						Authorization: `Bearer ${token}`,
						...(lastETag ? { "If-None-Match": lastETag } : {}),
					},
				})

				const currentETag = headResponse.headers.get("etag")

				if (headResponse.status === 304 || (currentETag && currentETag === lastETag)) {
					console.log("✅ Templates cache is up to date")
					const localTemplates = await this.getAllLocalTemplates()
					if (localTemplates.length > 0) {
						localTemplates.forEach((t) => this.templateCache.set(t.remoteId!, t))
						return localTemplates
					}
				}

				// ETag changed - fetch fresh list from server
				console.log("📥 Templates updated, fetching from server...")
				const serverTemplates = await InspectionsAPI.getTemplates()

				if (currentETag) {
					await SecureStore.setItemAsync("templatesETag", currentETag)
				}

				// for (const serverTemplate of serverTemplates) {
				// 	const template = await this.saveTemplateLocally(serverTemplate)
				// 	this.templateCache.set(template.remoteId!, template)
				// }

				await this.saveTemplatesLocallyBatch(serverTemplates)

				// purge local templates missing from fresh server list
				await this.purgeDeletedLocalTemplates(serverTemplates)

				return await this.getAllLocalTemplates()
			} catch (err) {
				console.error("Failed to fetch templates:", err)
				// fall back to local
				const localTemplates = await this.getAllLocalTemplates()
				if (localTemplates.length > 0) {
					return localTemplates
				}
				throw new Error("Unable to load templates. Please check your connection.")
			}
		}

		// offline - use local
		const localTemplates = await this.getAllLocalTemplates()
		if (localTemplates.length > 0) {
			return localTemplates
		}

		throw new Error("No templates available offline. Please connect to download templates.")
	}

	/**
	 * Prefetch templates for offline use
	 */
	async prefetchTemplates(): Promise<void> {
		if (!NetworkMonitor.isOnline()) {
			console.log("Offline, skipping template prefetch")
			return
		}

		try {
			console.log("📥 Prefetching templates...")
			await this.getAvailableTemplates()
			console.log("✅ Templates prefetched")
		} catch (err) {
			console.error("❌ Prefetch failed:", err)
		}
	}

	/**
	 * Remove a single template from local DB and in-memory cache.
	 * Called when validateTemplate() receives a 404 from the server.
	 */
	private async purgeLocalTemplate(templateId: string): Promise<void> {
		this.templateCache.delete(templateId)
		try {
			const records = await this.collection.query(Q.where("remote_id", templateId)).fetch()
			if (records.length > 0) {
				await database.write(async () => {
					await Promise.all(records.map((r) => r.markAsDeleted()))
				})
				console.log(`🗑️ Purged deleted template ${templateId} from local DB`)
			}
		} catch (err) {
			console.warn("Failed to purge local template:", err)
		}
	}

	/**
	 * After a full list refresh, delete local templates absent from the server list.
	 * These were deleted on the backend while the device was offline.
	 */
	private async purgeDeletedLocalTemplates(
		serverTemplates: InspectionTemplateDTO[],
	): Promise<void> {
		const serverIds = new Set(serverTemplates.map((t) => t.id))
		const localTemplates = await this.getAllLocalTemplates()
		const stale = localTemplates.filter((t) => t.remoteId && !serverIds.has(t.remoteId))

		if (stale.length === 0) return

		console.log(`🗑️ Purging ${stale.length} deleted template(s) from local DB`)
		await database.write(async () => {
			await Promise.all(stale.map((t) => t.markAsDeleted()))
		})
		stale.forEach((t) => this.templateCache.delete(t.remoteId!))
	}

	private async getLocalTemplate(templateId: string): Promise<InspectionTemplate | null> {
		try {
			const records = await this.collection.query(Q.where("remote_id", templateId)).fetch()
			return records.at(0) || null
		} catch (err) {
			console.error("Error fetching local template:", err)
			return null
		}
	}

	private async getAllLocalTemplates(): Promise<InspectionTemplate[]> {
		try {
			return await this.collection.query().fetch()
		} catch (err) {
			console.error("Error fetching local templates:", err)
			return []
		}
	}

	private async saveTemplatesLocallyBatch(
		templates: InspectionTemplateDTO[],
	): Promise<InspectionTemplate[]> {
		const now = Date.now()
		const createdOrUpdated: InspectionTemplate[] = []

		await database.write(async () => {
			for (const template of templates) {
				const existingRecords = await this.collection
					.query(Q.where("remote_id", template.id))
					.fetch()
				const existingRecord = existingRecords.at(0) || null

				if (existingRecord) {
					existingRecord.update((record) => {
						record.name = template.name
						record.version = template.version
						record.checklistItems = JSON.stringify(template.checklist_items)
						record.syncedTs = now
					})
					createdOrUpdated.push(existingRecord)
				} else {
					const newRecord = await this.collection.create((record) => {
						record.remoteId = template.id
						record.name = template.name
						record.version = template.version
						record.checklistItems = JSON.stringify(template.checklist_items)
						record.syncedTs = now
						record.createdTs = now
					})
					createdOrUpdated.push(newRecord)
				}
			}
		})

		// update cache outside the write transaction
		createdOrUpdated.forEach((t) => this.templateCache.set(t.remoteId!, t))
		return createdOrUpdated
	}

	private async saveTemplateLocally(template: InspectionTemplateDTO): Promise<InspectionTemplate> {
		const existing = await this.collection.query(Q.where("remote_id", template.id)).fetch()
		const existingRecord = existing.at(0) || null

		const now = Date.now()

		return await database.write(async () => {
			if (existingRecord) {
				return await existingRecord.update((record) => {
					record.name = template.name
					record.version = template.version
					record.checklistItems = JSON.stringify(template.checklist_items)
					record.syncedTs = now
				})
			} else {
				return await this.collection.create((record) => {
					record.remoteId = template.id
					record.name = template.name
					record.version = template.version
					record.checklistItems = JSON.stringify(template.checklist_items)
					record.syncedTs = now
					record.createdTs = now
				})
			}
		})
	}

	/**
	 * Clear template cache on logout
	 */
	clearCache(): void {
		this.templateCache.clear()
	}
}

export default new TemplateValidationService()
