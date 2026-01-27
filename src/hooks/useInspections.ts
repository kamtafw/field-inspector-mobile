import { useCallback, useEffect, useState } from "react"
import { Subscription } from "rxjs"
import { Q } from "@nozbe/watermelondb"
import database from "@/src/database"
import Inspection from "@/src/database/models/Inspection"
import InspectionRepository, {
	CreateInspectionPayload,
	UpdateInspectionPayload,
} from "@/src/database/repositories/InspectionRepository"
import { useAuth } from "@/src/providers/AuthProvider"
import ErrorAlert from "@/src/components/ui/ErrorAlert"
import ErrorHandler from "@/src/services/error/ErrorHandler"

interface UseInspectionsReturn {
	inspections: Inspection[] | null

	isLoading: boolean
	isCreating: boolean
	isUpdating: boolean

	error: string | null

	createInspection: (data: CreateInspectionPayload) => Promise<Inspection>
	updateInspection: (id: string, data: UpdateInspectionPayload) => Promise<Inspection>
	deleteInspection: (id: string) => Promise<void>
	getInspectionById: (id: string) => Promise<Inspection | null>

	submitInspection: (id: string) => Promise<void>
}

export default function useInspections(): UseInspectionsReturn {
	const { userId } = useAuth()

	const [inspections, setInspections] = useState<Inspection[] | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [isUpdating, setIsUpdating] = useState(true)
	const [isCreating, setIsCreating] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		let subscription: Subscription | null = null

		// load inspections when user change
		const loadAndObserve = async () => {
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
				query = collection.query(Q.sortBy("created_ts", Q.desc))

				subscription = query.observe().subscribe((records) => {
					setInspections(records)
				})
			} catch (err: any) {
				console.error("Error loading inspections:", err)
				const errorMessage = ErrorHandler.getSimpleMessage(err)
				setError(errorMessage)
			} finally {
				setIsLoading(false)
			}
		}

		loadAndObserve()

		return () => {
			if (subscription) {
				subscription.unsubscribe()
			}
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
				userId,
			)
			console.log("✅ Inspection created:", inspection.id)

			return inspection
		} catch (err: any) {
			const errorMessage = err.message || "Failed to create inspection"
			setError(errorMessage)
			console.error("Error creating inspection:", err)
			ErrorAlert.show(err, () => createInspection(data))
			throw err
		} finally {
			setIsCreating(false)
		}
	}

	const updateInspection = async (
		id: string,
		data: UpdateInspectionPayload,
	): Promise<Inspection> => {
		if (!userId) {
			throw new Error("User must be authenticated to create an inspection")
		}

		setIsUpdating(true)
		setError(null)

		try {
			const inspection = await InspectionRepository.update(id, data)
			return inspection
		} catch (err: any) {
			console.error("Error updating inspection:", err)
			ErrorAlert.show(err, () => updateInspection(id, data))
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
		} catch (err: any) {
			console.error("Error deleting inspection:", err)
			ErrorAlert.show(err, () => deleteInspection(id))
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
		try {
			await InspectionRepository.submitInspection(id)
			console.log("📤 Inspection submitted, triggering sync...")
		} catch (err) {
			console.error("Failed to submit inspection:", err)
			ErrorAlert.show(err, () => deleteInspection(id))
			throw err
		}
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
	}
}
