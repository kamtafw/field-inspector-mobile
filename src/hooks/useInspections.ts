import { useCallback, useEffect, useState } from "react"
import Inspection, { InspectionResponse } from "../database/models/Inspection"
import InspectionRepository, {
	CreateInspectionPayload,
	UpdateInspectionPayload,
} from "../database/repositories/InspectionRepository"
import database from "../database"
import { Q } from "@nozbe/watermelondb"
import { useAuth } from "../providers/AuthProvider"

interface UseInspectionsReturn {
	// data
	inspections: Inspection[]

	// loading states
	isLoading: boolean
	isCreating: boolean
	isUpdating: boolean

	// error states
	error: string | null

	// CRUD operations
	createInspection: (data: CreateInspectionPayload) => Promise<Inspection>
	updateInspection: (id: string, data: UpdateInspectionPayload) => Promise<Inspection>
	deleteInspection: (id: string) => Promise<void>
	getInspectionById: (id: string) => Promise<Inspection | null>

	// actions
	submitInspection: (id: string) => Promise<void>
	refresh: () => Promise<void>
}

export default function useInspections(): UseInspectionsReturn {
	const { userId } = useAuth()

	const [inspections, setInspections] = useState<Inspection[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [isCreating, setIsCreating] = useState(false)
	const [isUpdating, setIsUpdating] = useState(true)
	const [error, setError] = useState<string | null>(null)

	// load inspections when user change
	useEffect(() => {
		if (userId) {
			loadInspections()
		}
	}, [userId])

	const loadInspections = useCallback(async () => {
		if (!userId) return

		try {
			setIsLoading(true)
			setError(null)

			const collection = database.get<Inspection>("inspections")
			let query = collection.query(Q.where("inspector_id", userId))

			// apply status filter
			// apply search filter
			// apply date range filter
			// sort by most recent

			const results = await query.fetch()
			setInspections(results)

			// load stats
		} catch (err: any) {
			setError(err.message)
			console.error("Error loading inspections:", err)
		} finally {
			setIsLoading(false)
		}
	}, [userId])

	const createInspection = async (data: CreateInspectionPayload): Promise<Inspection> => {
		if (!userId) {
			throw new Error("User must be authenticated to create an inspection")
		}

		setIsCreating(true)
		setError(null)

		try {
			const inspection = await InspectionRepository.create(
				{
					templateId: data.templateId,
					facilityName: data.facilityName,
					facilityAddress: data.facilityAddress,
					responses: JSON.parse(JSON.stringify(data.responses)),
				},
				userId
			)

			console.log("✅ Inspection created:", inspection.id)

			// TODO: doubt this is necessary cos of withObservables
			await loadInspections()

			return inspection
		} catch (err: any) {
			const errorMessage = err.message || "Failed to create inspection"
			setError(errorMessage)
			console.error("Error creating inspection:", err)
			throw err
		} finally {
			setIsCreating(false)
		}
	}

	const updateInspection = async (
		id: string,
		data: UpdateInspectionPayload
	): Promise<Inspection> => {
		if (!userId) {
			throw new Error("User must be authenticated to create an inspection")
		}

		setIsUpdating(true)
		setError(null)

		try {
			const inspection = await InspectionRepository.update(id, data)

			console.log("✅ Inspection updated:", inspection.id)

			// TODO: doubt this is necessary cos of withObservables
			await loadInspections()

			return inspection
		} catch (err: any) {
			const errorMessage = err.message || "Failed to update inspection"
			setError(errorMessage)
			console.error("Error updating inspection:", err)
			throw err
		} finally {
			setIsUpdating(false)
		}
	}

	const deleteInspection = async (id: string): Promise<void> => {
		setError(null)

		try {
			await InspectionRepository.delete(id)

			console.log("✅ Inspection deleted:", id)

			// TODO: doubt this is necessary cos of withObservables
			await loadInspections()
		} catch (err: any) {
			const errorMessage = err.message || "Failed to delete inspection"
			setError(errorMessage)
			console.error("Error deleting inspection:", err)
			throw err
		}
	}

	const getInspectionById = async (id: string): Promise<Inspection | null> => {
		try {
			return await InspectionRepository.getById(id)
		} catch (err) {
			console.error("Error fetching inspection:", err)
			return null
		}
	}

	/** Submit inspection (change inspection status to submitted) */
	const submitInspection = async (id: string): Promise<void> => {
		await updateInspection(id, { status: "submitted" })
	}

	/** Refresh (reload) inspections */
	const refresh = async () => {
		await loadInspections()
	}

	return {
		// data
		inspections,

		// loading states
		isLoading,
		isCreating,
		isUpdating,

		// error state
		error,

		// CRUD operations
		createInspection,
		updateInspection,
		deleteInspection,
		getInspectionById,

		// actions
		submitInspection,
		refresh,
	}
}
