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
		valid: boolean
		template?: InspectionTemplate
		error?: string
		isDeleted?: boolean
	}> {
		console.log(`Check for template with id: ${templateId}`)
		// check cache first
		const cached = this.templateCache.get(templateId)
		if (cached) {
			return { valid: true, template: cached }
		}

		// check local database
		try {
			const localTemplate = await this.getLocalTemplate(templateId)
			if (localTemplate) {
				this.templateCache.set(templateId, localTemplate)
				return { valid: true, template: localTemplate }
			}
		} catch (err) {
			console.warn("Error checking local templates:", err)
		}

		// fetch from server if online
		if (NetworkMonitor.isOnline()) {
			try {
				const serverTemplate = await InspectionsAPI.getTemplateById(templateId)
				const template = await this.saveTemplateLocally(serverTemplate)
				this.templateCache.set(templateId, template)
				return { valid: true, template: template }
			} catch (err: any) {
				if (err.response?.status === 404) {
					return {
						valid: false,
						error: "This template is no longer available.",
						isDeleted: true,
					}
				}

				return {
					valid: false,
					error: "Unable to load template. Please check your connection.",
				}
			}
		}

		return {
			valid: false,
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

				// ETag changed - fetch from server
				console.log("📥 Templates updated, fetching from server...")
				const serverTemplates = await InspectionsAPI.getTemplates()

				if (currentETag) {
					await SecureStore.setItemAsync("templatesETag", currentETag)
				}

				for (const serverTemplate of serverTemplates) {
					const template = await this.saveTemplateLocally(serverTemplate)
					this.templateCache.set(template.remoteId!, template)
				}

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
