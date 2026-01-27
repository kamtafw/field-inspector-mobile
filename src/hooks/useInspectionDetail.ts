import { useEffect, useState } from "react"
import { Subscription } from "rxjs"
import Inspection from "../database/models/Inspection"
import InspectionRepository from "../database/repositories/InspectionRepository"

interface UseInspectionDetailReturn {
	inspection: Inspection | null
	isLoading: boolean
	error: string | null
	refresh: () => Promise<void>
}

/**
 * Hook to observe a single inspection with real-time updates
 * Updates automatically when inspection changes (e.g., after sync)
 */
export default function useInspectionDetail(inspectionId: string): UseInspectionDetailReturn {
	const [inspection, setInspection] = useState<Inspection | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		let subscription: Subscription | null = null

		const loadAndObserve = async () => {
			try {
				setIsLoading(true)
				setError(null)

				const inspectionRecord = await InspectionRepository.getById(inspectionId)

				if (!inspectionRecord) {
					setError("Inspection not found")
					setInspection(null)
					return
				}

				setInspection(inspectionRecord)

				subscription = inspectionRecord.observe().subscribe({
					next: (updated) => {
						console.log("🔄 Inspection updated:", updated.id, updated.status)
						setInspection(updated)
					},
					error: (err) => {
						console.error("Error observing inspection:", err)
						setError(err.message)
					},
				})
			} catch (err: any) {
				console.error("Failed to load inspection:", err)
				setError(err.message || "Failed to load inspection")
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
	}, [inspectionId])

	const refresh = async () => {
		try {
			setIsLoading(true)
			setError(null)

			const inspectionRecord = await InspectionRepository.getById(inspectionId)

			if (!inspectionRecord) {
				setError("Inspection not found")
				setInspection(null)
				return
			}

			setInspection(inspectionRecord)
		} catch (err: any) {
			console.error("Failed to refresh inspection:", err)
			setError(err.message || "Failed to refresh")
		} finally {
			setIsLoading(false)
		}
	}

	return {
		inspection,
		isLoading,
		error,
		refresh,
	}
}
