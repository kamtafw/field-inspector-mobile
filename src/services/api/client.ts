import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios"
import * as SecureStore from "expo-secure-store"
import { API_BASE_URL } from "../../config"
import { TIMEOUT_DURATION } from "@/src/config/constants"

interface TokenPair {
	accessToken: string
	refreshToken: string
}

const api: AxiosInstance = axios.create({
	baseURL: API_BASE_URL,
	timeout: TIMEOUT_DURATION,
})

// Request interceptor: Add token
api.interceptors.request.use(
	async (config: InternalAxiosRequestConfig) => {
		const token = await SecureStore.getItemAsync("accessToken")
		if (token) {
			config.headers.Authorization = `Bearer ${token}`
		}
		return config
	},
	(error) => Promise.reject(error)
)

// Response interceptor: Handle 401
api.interceptors.response.use(
	(response) => response,
	async (error: AxiosError) => {
		const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

		if (error.response?.status === 401 && !originalRequest._retry) {
			originalRequest._retry = true
			const refreshToken = await SecureStore.getItemAsync("refreshToken")
			if (refreshToken) {
				try {
					const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
						refresh: refreshToken,
					})

					const newAccessToken = response.data.accessToken
					await SecureStore.setItemAsync("accessToken", newAccessToken)

					// retry original request
					originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
					return api(originalRequest)
				} catch {
					// Refresh failed, force re-login
					// TODO: navigate to login screen
				}
			}
		}
	}
)

export default api
