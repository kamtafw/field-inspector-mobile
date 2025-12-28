import { InspectionResponse } from "../database/models/Inspection"
import InspectionRepository from "../database/repositories/InspectionRepository"
import { useAuth } from "./useAuth"

interface InspectionData {
	templateId: string
	facilityName: string
	facilityAddress: string
	responses: InspectionResponse
}

export const useInspections = () => {
	const { userId } = useAuth()

	const createInspection = async (data: InspectionData) => {
		// 1. save to local DB
		const inspection = await InspectionRepository.create(
			{
				templateId: data.templateId,
				facilityName: data.facilityName,
				facilityAddress: data.facilityAddress,
				responses: data.responses,
			},
			userId
		)

		// 2. queue for sync

		// return optimistically
		return inspection
	}

	return { createInspection }
}
