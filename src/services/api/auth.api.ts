import api from "./client"
import * as SecureStore from "expo-secure-store"

export interface LoginCredentials {
	email: string
	password: string
}

export interface LoginResponse {
	access: string
	refresh: string
	user: {
		id: string
		email: string
		name: string
		role: "inspector" | "manager"
	}
}

export interface RefreshResponse {
	access: string
}

class AuthAPI {
	// Login user and store tokens
	async login(credentials: LoginCredentials): Promise<LoginResponse> {
		const response = await api.post<LoginResponse>("/auth/login/", credentials)

		// store tokens securely
		await SecureStore.setItemAsync("accessToken", response.data.access)
		await SecureStore.setItemAsync("refreshToken", response.data.refresh)

		// store user info for offline access
		await SecureStore.setItemAsync("user", JSON.stringify(response.data.user))
		await SecureStore.setItemAsync("userId", String(response.data.user.id))

		return response.data
	}

	// Refresh access token
	async refreshToken(refreshToken: string): Promise<RefreshResponse> {
		const response = await api.post<RefreshResponse>("/auth/refresh/", { refresh: refreshToken })
		// update access token
		await SecureStore.setItemAsync("accessToken", response.data.access)

		return response.data
	}

	// Logout user and clear tokens
	async logout(): Promise<void> {
		try {
			const refreshToken = await SecureStore.getItemAsync("refreshToken")
			if (refreshToken) {
				// invalidate refresh token on server
				await api.post("/auth/logout", { refresh: refreshToken })
			}
		} catch (error) {
			// ignore logout errors & proceed to clear tokens
			console.error("Logout error:", error)
		} finally {
			await SecureStore.deleteItemAsync("accessToken")
			await SecureStore.deleteItemAsync("refreshToken")
			await SecureStore.deleteItemAsync("user")
		}
	}

	// Get stored user info
	async getCurrentUser(): Promise<LoginResponse["user"] | null> {
		try {
			const userData = await SecureStore.getItemAsync("user")
			return userData ? JSON.parse(userData) : null
		} catch (error) {
			console.error("Error fetching user data:", error)
			return null
		}
	}

	// Check if user is authenticated
	async isAuthenticated(): Promise<boolean> {
		const accessToken = await SecureStore.getItemAsync("accessToken")
		const refreshToken = await SecureStore.getItemAsync("refreshToken")

		return Boolean(accessToken && refreshToken)
	}
}

export default new AuthAPI()
