import database from "@/src/database"
import InspectionsAPI, { InspectionTemplateDTO } from "../api/inspections.api"
import NetworkMonitor from "../network/NetworkMonitor"
import InspectionTemplate from "@/src/database/models/InspectionTemplate"
import { Q } from "@nozbe/watermelondb"

class TemplateValidationService {
	private collection = database.get<InspectionTemplate>("inspection_templates")

	private templateCache: Map<string, InspectionTemplate> = new Map()
	private lastFetchTime: number = 0
	private readonly CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

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

				// cache locally
				const template = await this.saveTemplateLocally(serverTemplate)
				this.templateCache.set(templateId, template)

				return { valid: true, template: template }
			} catch (err: any) {
				console.error("Failed to fetch template from server:", err)

				if (err.response?.status === 404) {
					return {
						valid: false,
						error: "This template is no longer available.",
						isDeleted: true,
					}
				}

				return {
					valid: false,
					error: "Unable to load template. Please check your connection and try again.",
				}
			}
		}

		// offline and no local copy
		return {
			valid: false,
			error: "Template not available offline. Please connect to the internet to download it.",
		}
	}

	/**
	 * Get all available templates
	 * Returns cached or fetches from server
	 */
	async getAvailableTemplates(): Promise<InspectionTemplate[]> {
		// use cache if fresh
		const now = Date.now()

		if (this.templateCache.size > 0 && now - this.lastFetchTime < this.CACHE_DURATION) {
			return Array.from(this.templateCache.values())
		}

		// try local first
		try {
			const localTemplates = await this.getAllLocalTemplates()
			if (localTemplates.length > 0) {
				localTemplates.forEach((t) => this.templateCache.set(t.id, t))
				return localTemplates
			}
		} catch (err) {
			console.warn("Error loading local templates:", err)
		}

		// fetch from server if online
		if (NetworkMonitor.isOnline()) {
			try {
				const serverTemplates = await InspectionsAPI.getTemplates()

				for (const serverTemplate of serverTemplates) {
					const template = await this.saveTemplateLocally(serverTemplate)
					this.templateCache.set(template.id, template)
				}

				this.lastFetchTime = now
				return await this.getAllLocalTemplates()
			} catch (err) {
				console.error("Failed to fetch templates:", err)
				throw new Error("Unable to load templates. Please check your connection.")
			}
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
			console.log("✅ Templates prefetched successfully")
		} catch (err) {
			console.error("❌ Template prefetch failed:", err)
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

		const presentTemplate = await database.write(async () => {
			if (existingRecord) {
				const updatedTemplate = await existingRecord.update((record) => {
					record.name = template.name
					record.version = template.version
					record.checklistItems = JSON.stringify(template.checklist_items)
					record.syncedTs = now
				})

				return updatedTemplate
			} else {
				const newTemplate = await this.collection.create((record) => {
					record.remoteId = template.id
					record.name = template.name
					record.version = template.version
					record.checklistItems = JSON.stringify(template.checklist_items)
					record.syncedTs = now
					record.createdTs = now
				})

				return newTemplate
			}
		})

		return presentTemplate
	}

	/**
	 * Clear template cache on logout
	 */
	clearCache(): void {
		this.templateCache.clear()
		this.lastFetchTime = 0
	}
}

export default new TemplateValidationService()
