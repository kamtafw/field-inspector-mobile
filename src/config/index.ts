import Constants from "expo-constants"

const getLocalIP = (fallback = "0.0.0.0"): string => {
	const debuggerHost = Constants.expoConfig?.hostUri

	if (debuggerHost) {
		const ip = debuggerHost.split(":")[0]
		return ip
	}

	console.log("Using fallback IP:", fallback)
	return fallback
}

export const API_BASE_URL = __DEV__
	? `http://${getLocalIP()}:8000/api/v1` // Replace with YOUR computer's IP (`http://${ENDPOINTS.IPv4}:8000/api/`)
	: "https://your-production-api.com/api"
