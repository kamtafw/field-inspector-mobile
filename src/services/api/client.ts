import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios"
import * as SecureStore from "expo-secure-store"
import { API_BASE_URL } from "../../config"
import { TIMEOUT_DURATION } from "@/src/config/constants"
import NetInfo from "@react-native-community/netinfo"

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
	_retry?: boolean
	_offlineByPass?: boolean
}

/** track if system's currently refreshing - to prevent multiple refresh calls */
let isRefreshing = false

/** queue of requests waiting for token refresh */
let refreshSubscribers: Array<(token: string) => void> = []

/** add subscriber to queue */
function subscribeTokenRefresh(callback: (token: string) => void) {
	refreshSubscribers.push(callback)
}

/** notify all subscribers when token refresh completes */
function onTokenRefreshed(token: string) {
	refreshSubscribers.forEach((callback) => callback(token))
	refreshSubscribers = []
}

const api: AxiosInstance = axios.create({
	baseURL: API_BASE_URL,
	timeout: TIMEOUT_DURATION,
	headers: {
		"Content-Type": "application/json",
	},
})

/** Request Interceptor */
api.interceptors.request.use(
	async (config: InternalAxiosRequestConfig) => {
		const isAuthEndpoint =
			config.url?.includes("/auth/login") ||
			config.url?.includes("/auth/signup") ||
			config.url?.includes("/auth/refresh")

		if (isAuthEndpoint) {
			return config
		}

		try {
			const accessToken = await SecureStore.getItemAsync("accessToken")

			if (accessToken) {
				config.headers.Authorization = `Bearer ${accessToken}`
			}
		} catch (err) {
			console.error("Failed to get access token:", err)
		}

		return config
	},
	(error) => {
		console.error("Request interceptor error:", error)
		return Promise.reject(error)
	},
)

/** Response Interceptor */
api.interceptors.response.use(
	(response) => response,

	// error response - handle 401
	async (error: AxiosError) => {
		const originalRequest = error.config as CustomAxiosRequestConfig

		// handle network errors
		if (!error.response) {
			console.error("Network error:", error.message)
			return Promise.reject({
				message: "Network error. Please check your connection.",
				isNetworkError: true,
				originalError: error,
			})
		}

		const isAuthEndpoint =
			originalRequest?.url?.includes("/auth/login") ||
			originalRequest?.url?.includes("/auth/signup") ||
			originalRequest?.url?.includes("/auth/refresh")

		if (isAuthEndpoint) {
			// for auth endpoints, return the actual error from the server
			const status = error.response.status
			const serverMessage =
				(error.response.data as any)?.message ||
				(error.response.data as any)?.detail ||
				(error.response.data as any)?.error

			let userMessage: string

			if (status === 401 || status === 403) {
				// wrong credentials
				userMessage = serverMessage || "Invalid email or password"
			} else if (status >= 500) {
				userMessage = "Server error. Please try again later."
			} else if (status === 400) {
				// validation error
				userMessage = serverMessage || "Please check your input and try again"
			} else {
				userMessage = serverMessage || "Login failed"
			}

			return Promise.reject({
				message: userMessage,
				status: status,
				isAuthEndpoint: true,
				originalError: error,
			})
		}

		// handle 401 unauthorized for PROTECTED endpoints only
		if (error.response.status === 401 && originalRequest && !originalRequest._retry) {
			console.log("🔄 401 detected on protected endpoint, attempting token refresh...")

			const netState = await NetInfo.fetch()

			if (!netState.isConnected) {
				console.log("⚠️ Token expired while offline - allowing offline mode")

				// store flag that token needs refresh when online
				await SecureStore.setItemAsync("needsTokenRefresh", "true")

				// allow request to pass through for offline operations
				const newConfig = { ...originalRequest }
				delete newConfig.headers.Authorization
				return Promise.resolve({
					data: null,
					config: newConfig,
					headers: {},
					status: 200,
					statusText: "Offline Mode",
				})
			}

			// mark request as retried
			originalRequest._retry = true

			if (isRefreshing) {
				console.log("⏳ Already refreshing, queueing request...")

				return new Promise((resolve) => {
					subscribeTokenRefresh((newToken: string) => {
						originalRequest.headers.Authorization = `Bearer ${newToken}`
						resolve(api(originalRequest))
					})
				})
			}

			isRefreshing = true

			try {
				const refreshToken = await SecureStore.getItemAsync("refreshToken")

				if (!refreshToken) {
					console.error("❌ No refresh token available")
					throw new Error("No refresh token")
				}

				console.log("🔑 Refreshing token...")

				const response = await axios.post(
					`${API_BASE_URL}/auth/refresh/`,
					{ refresh: refreshToken },
					{ timeout: TIMEOUT_DURATION },
				)

				const newAccessToken = response.data.access

				if (!newAccessToken) {
					throw new Error("No access token in refresh response")
				}

				await SecureStore.setItemAsync("accessToken", newAccessToken)

				if (response.data.refresh) {
					await SecureStore.setItemAsync("refreshToken", response.data.refresh)
				}

				await SecureStore.deleteItemAsync("needsTokenRefresh")

				console.log("✅ Token refreshed successfully")

				onTokenRefreshed(newAccessToken)
				isRefreshing = false

				// retry original request with new token
				originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
				return api(originalRequest)
			} catch (refreshError: any) {
				console.error("❌ Token refresh failed:", refreshError)

				isRefreshing = false
				refreshSubscribers = []

				const netState2 = await NetInfo.fetch()
				if (netState2.isConnected) {
					await SecureStore.deleteItemAsync("accessToken")
					await SecureStore.deleteItemAsync("refreshToken")
					emitLogoutEvent()
				} else {
					await SecureStore.setItemAsync("needsTokenRefresh", "true")
				}

				return Promise.reject({
					message: netState2.isConnected
						? "Session expired. Please log in again"
						: "Offline - will sync when connected",
					isAuthError: netState2.isConnected,
					isOfflineAuthError: !netState2.isConnected,
					originalError: refreshError,
				})
			}
		}

		// handle other errors
		console.error("API Error:", {
			status: error.response.status,
			url: error.config?.url,
			message: error.message,
		})

		return Promise.reject(error)
	},
)

/** Event listeners for logout */
let logoutListeners: Array<() => void> = []

/** Subscribe to logout events */
export function onLogout(callback: () => void) {
	logoutListeners.push(callback)

	// return unsubscribe function
	return () => {
		logoutListeners = logoutListeners.filter((cb) => cb !== callback)
	}
}

/** Emit logout event to all listeners */
function emitLogoutEvent() {
	console.log("🚪 Emitting logout event")
	logoutListeners.forEach((callback) => callback())
}

/** Check if error is network-related */
export function isNetworkError(error: any): boolean {
	return error?.isNetworkError === true || !error?.response
}

/** Check if error is authentication-related (session expired, not login failure) */
export function isAuthError(error: any): boolean {
	if (error?.isAuthEndpoint) {
		return false
	}
	return error?.isAuthError === true
}

/** Check if error is a login/signup failure */
export function isLoginError(error: any): boolean {
	return error?.isAuthEndpoint === true
}

/** Get user-friendly error message */
export function getErrorMessage(error: any): string {
	// use message if it's already set
	if (error?.message && typeof error.message === "string") {
		return error.message
	}

	if (error?.response?.data?.message) {
		return error.response.data.message
	}

	if (error?.response?.data?.error) {
		return error.response.data.error
	}

	if (error?.response?.status === 401) {
		// only show session expired for non-auth endpoints
		const isAuthEndpoint = error?.config?.url?.includes("/auth/")
		return isAuthEndpoint ? "Invalid email or password" : "Session expired. Please log in again."
	}

	if (error?.response?.status === 403) {
		return "You do not have permission to perform this action."
	}

	if (error?.response?.status === 404) {
		return "Resource not found."
	}

	if (error?.response?.status === 500) {
		return "Server error. Please try again later."
	}

	return "An unexpected error occurred."
}

export default api
