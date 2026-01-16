export interface ConflictAnalysis {
	hasConflict: boolean
	conflictFields: string[]
	severity: "low" | "medium" | "high"
	autoMergeable: boolean
	suggestedStrategy: "keep_mine" | "keep_theirs" | "merge"
}

class ConflictDetector {
	/** Detects conflicts between client and server data */
	detectConflicts(clientData: any, serverData: any): string[] {
		const conflicts: string[] = []

		if (clientData.facilityName !== serverData.facilityName) {
			conflicts.push("facility_name")
		}

		if (clientData.facilityAddress !== serverData.facilityAddress) {
			conflicts.push("facility_address")
		}

		if (clientData.status !== serverData.status) {
			conflicts.push("status")
		}

		const clientResponses = clientData.responses || {}
		const serverResponses = serverData.responses || {}

		const allItemsIds = new Set([...Object.keys(clientResponses), ...Object.keys(serverResponses)])

		for (const itemId of allItemsIds) {
			const clientValue = clientResponses[itemId]?.value
			const serverValue = serverResponses[itemId]?.value

			if (clientValue !== serverValue) {
				conflicts.push(`responses.${itemId}`)
			}
		}

		return conflicts
	}

	/** Analyze conflict severity and suggest resolution */
	analyzeConflict(clientData: any, serverData: any, conflictFields: string[]): ConflictAnalysis {
		// **high severity if status conflicts or many fields conflicts
		const severity =
			conflictFields.includes("status") || conflictFields.length > 5
				? "high"
				: conflictFields.length > 2
				? "medium"
				: "low"

		// can auto-merge if only text fields (not critical fields like status)
		const criticalFields = ["status", "facility_name"]
		const hasCriticalConflict = conflictFields.some((f) => criticalFields.includes(f))
		const autoMergeable = !hasCriticalConflict && conflictFields.length <= 2

		let suggestedStrategy: "keep_mine" | "keep_theirs" | "merge" = "merge"

		if (hasCriticalConflict) {
			suggestedStrategy = "merge"
		} else if (this.isServerNewer(clientData, serverData)) {
			suggestedStrategy = "keep_theirs"
		} else {
			suggestedStrategy = "keep_mine"
		}

		return {
			hasConflict: conflictFields.length > 0,
			conflictFields,
			severity,
			autoMergeable,
			suggestedStrategy,
		}
	}

	/** Check if server data is newer based on timestamps */
	private isServerNewer(clientData: any, serverData: any): boolean {
		const clientResponses = clientData.responses || {}
		const serverResponses = serverData.responses || {}

		const clientTimestamps = Object.values(clientResponses).map((r: any) => r.timestamp || 0)
		const serverTimestamps = Object.values(serverResponses).map((r: any) => r.timestamp || 0)

		const clientLatest = Math.max(...clientTimestamps, 0)
		const serverLatest = Math.max(...serverTimestamps, 0)

		return serverLatest > clientLatest
	}

	/** Auto-merge non-conflicting fields */
	autoMerge(clientData: any, serverData: any, conflictFields: string[]): any {
		const merged = { ...serverData }

		const clientResponses = clientData.responses || {}
		const serverResponses = serverData.responses || {}
		const mergedResponses = { ...serverResponses }

		for (const [itemId, clientResponse] of Object.entries(clientResponses)) {
			const serverResponse = serverResponses[itemId] as any
			const clientResp = clientResponse as any

			// **use newer timestamp if item doesn't conflict
			const fieldKey = `responses.${itemId}`
			if (!conflictFields.includes(fieldKey)) {
				if (!serverResponse || clientResp.timestamp > serverResponse.timestamp) {
					mergedResponses[itemId] = clientResp
				}
			}
		}

		merged.responses = mergedResponses

		const simpleFields = ["facility_name", "facility_address"]
		for (const field of simpleFields) {
			if (!conflictFields.includes(field)) {
				merged[field] = clientData[field]
			}
		}

		return merged
	}
}

export default new ConflictDetector()
