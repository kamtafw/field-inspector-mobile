import api from "./client"
import { InspectionResponse } from "@/src/database/models/Inspection"

export interface CreateInspectionDTO {
	template_id: string
	facility_name: string
	facility_address: string
	responses: InspectionResponse
	status: "draft" | "submitted"
	version: number
}

export interface UpdateInspectionDTO {
	facility_name?: string
	facility_address?: string
	responses?: InspectionResponse
	status?: "submitted" | "approved" | "rejected"
	version: number // REQUIRED for conflict detection
}

export interface InspectionResponseDTO {
	id: string
	template_id: string
	facility_name: string
	facility_address: string
	responses: InspectionResponse
	status: "draft" | "submitted" | "approved" | "rejected"
	version: number
	inspector: {
		id: string
		email: string
		first_name: string
		last_name: string
	}
	approved_by?: {
		id: string
		email: string
		first_name: string
		last_name: string
	}
	approved_at?: string // ISO date string
	approval_notes?: string
	created_at: string // ISO date string
	submitted_at?: string // ISO date string
	updated_at: string // ISO date string
}

export interface ConflictResponse {
	error: "conflict"
	message: string
	client_version: number
	server_version: number
	server_data: InspectionResponseDTO
}

export interface InspectionTemplateDTO {
	id: string
	name: string
	version: string
	checklist_items: ChecklistItemsDTO[]
	created_at: string
}

export interface ChecklistItemsDTO {
	id: string
	question: string
	type: "boolean" | "text" | "number" | "date"
	required?: boolean
	options?: string[] // for select-type questions
}

export interface PaginatedResponse<T> {
	count: number
	next: string | null
	previous: string | null
	results: T[]
}

export interface APIError {
	error: string
	message: string
	details?: Record<string, string[]>
}

class InspectionsAPI {
	/**
	 * Create inspection on server
	 * @param data - Inspection data
	 * @param idempotencyKey - UUID to prevent duplicates
	 * @returns Created inspection
	 * @throws APIError on validation/network errors
	 */
	async create(data: CreateInspectionDTO, idempotencyKey: string): Promise<InspectionResponseDTO> {
		try {
			const response = await api.post<InspectionResponseDTO>("/inspections/", data, {
				headers: { "Idempotency-Key": idempotencyKey },
			})

			return response.data
		} catch (err: any) {
			this.handleError(err, "Failed to create inspection")
			throw err
		}
	}

	/**
	 * Update inspection on server
	 * @param id - Inspection remote ID (server UUID)
	 * @param data - Fields to update
	 * @param idempotencyKey - UUID to prevent duplicates
	 * @returns Updated inspection or conflict response
	 * @throws 409 Conflict error if version mismatch
	 */
	async update(
		id: string,
		data: UpdateInspectionDTO,
		idempotencyKey: string
	): Promise<InspectionResponseDTO> {
		try {
			const response = await api.put<InspectionResponseDTO>(`/inspections/${id}/`, data, {
				headers: { "Idempotency-Key": idempotencyKey },
			})

			return response.data
		} catch (err: any) {
			// handle 409 conflict specially
			if (err.response?.status === 409) {
				console.log("⚠️ Conflict detected:", err.response.data)
				return err.response.data as any
			}

			this.handleError(err, "Failed to update inspection")
			throw err
		}
	}

	/**
	 * Fetch single inspection by ID
	 * @param id - Inspection remote ID
	 * @returns Inspection details
	 */
	async getById(id: string): Promise<InspectionResponseDTO> {
		try {
			const response = await api.get<InspectionResponseDTO>(`/inspections/${id}/`)
			return response.data
		} catch (err: any) {
			this.handleError(err, "Failed to fetch inspection")
			throw err
		}
	}

	/**
	 * Fetch all inspections for current user
	 * @param page - Page number (default: 1)
	 * @param pageSize - Items per page (default: 50)
	 * @returns Paginated inspections
	 */
	async getAll(
		page: number = 1,
		pageSize: number = 50
	): Promise<PaginatedResponse<InspectionResponseDTO>> {
		try {
			const response = await api.get<PaginatedResponse<InspectionResponseDTO>>(`/inspections/`, {
				params: { page, page_size: pageSize },
			})
			return response.data
		} catch (err: any) {
			this.handleError(err, "Failed to fetch inspections")
			throw err
		}
	}

	/**
	 * Fetch all inspection templates; templates are cached locally after first download
	 * @returns List of templates
	 */
	async getTemplates(): Promise<InspectionTemplateDTO[]> {
		try {
			const response = await api.get<InspectionTemplateDTO[]>("/templates/")
			return response.data
		} catch (err: any) {
			this.handleError(err, "Failed to fetch templates")
			throw err
		}
	}

	/**
	 * Fetch single template by ID
	 * @param id - Template ID
	 * @returns Template details
	 */
	async getTemplateById(id: string): Promise<InspectionTemplateDTO> {
		try {
			const response = await api.get<InspectionTemplateDTO>(`/templates/${id}/`)
			return response.data
		} catch (error: any) {
			this.handleError(error, "Failed to fetch template")
			throw error
		}
	}

	/**
	 * Batch sync multiple operations - useful for syncing many inspections at once
	 * @param operations - Array of sync operations
	 * @returns Results for each operation
	 */
	async batchSync(
		operations: Array<{
			operation_type: "CREATE_INSPECTION" | "UPDATE_INSPECTION"
			idempotency_key: string
			data: CreateInspectionDTO | UpdateInspectionDTO
		}>
	): Promise<
		Array<{
			success: boolean
			data?: InspectionResponseDTO
			error?: string
			conflict_data?: any
		}>
	> {
		try {
			const response = await api.post("/sync/batch/", { operations })
			return response.data
		} catch (err: any) {
			this.handleError(err, "Batch sync failed")
			throw err
		}
	}

	private handleError(error: any, defaultMessage: string): void {
		if (error.response) {
			// server responds with error
			const status = error.response.status
			const data = error.response.data as APIError

			console.error(`❌ API Error [${status}]:`, data)

			switch (status) {
				case 400:
					console.error("Validation error:", data.details)
					break
				case 401:
					console.error("Authentication failed")
					break
				case 403:
					console.error("Permission denied")
					break
				case 404:
					console.error("Resource not found")
					break
				case 409:
					console.error("Conflict detected")
					break
				case 500:
					console.error("Server error")
					break
				default:
					console.error("Unknown error")
			}
		} else if (error.request) {
			// request made but no response
			console.error("❌ Network error:", defaultMessage)
			console.error("Request:", error.request)
		} else {
			console.error("❌ Error:", error.message)
		}
	}
}

export default new InspectionsAPI()
