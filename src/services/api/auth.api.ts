import User from "@/src/database/models/User"
import api from "./client"
import * as SecureStore from "expo-secure-store"

export interface SignupCredentials {
	firstName: string
	lastName: string
	password: string
}

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
		first_name: string
		last_name: string
		role: "inspector" | "manager"
	}
}

export interface MappedUser {
	id: string
	email: string
	firstName: string
	lastName: string
	role: string
	loginTs: number
}

export interface RefreshResponse {
	access: string
}

function mapUser(user: LoginResponse["user"]): MappedUser {
	return {
		id: user.id,
		email: user.email,
		firstName: user.first_name,
		lastName: user.last_name,
		role: user.role,
		loginTs: Date.now(),
	}
}

class AuthAPI {
	/**
	 * Signup new user
	 * Email is auto-generated: firstName.lastName@vantage.com
	 */
	async signup(credentials: SignupCredentials): Promise<LoginResponse> {
		const response = await api.post<LoginResponse>("/auth/signup/", {
			first_name: credentials.firstName,
			last_name: credentials.lastName,
			password: credentials.password,
		})

		await SecureStore.setItemAsync("accessToken", response.data.access)
		await SecureStore.setItemAsync("refreshToken", response.data.refresh)

		const user = mapUser(response.data.user)

		await SecureStore.setItemAsync("user", JSON.stringify(user))
		await SecureStore.setItemAsync("userId", String(user.id))

		return response.data
	}

	/** Login user and store tokens */
	async login(credentials: LoginCredentials): Promise<LoginResponse> {
		const response = await api.post<LoginResponse>("/auth/login/", credentials)

		await SecureStore.setItemAsync("accessToken", response.data.access)
		await SecureStore.setItemAsync("refreshToken", response.data.refresh)

		const user = mapUser(response.data.user)

		await SecureStore.setItemAsync("user", JSON.stringify(user))
		await SecureStore.setItemAsync("userId", String(user.id))

		return response.data
	}

	/** Refresh access token */
	async refreshToken(refreshToken: string): Promise<RefreshResponse> {
		const response = await api.post<RefreshResponse>("/auth/refresh/", { refresh: refreshToken })

		await SecureStore.setItemAsync("accessToken", response.data.access)

		return response.data
	}

	/** Logout user and clear tokens */
	async logout(): Promise<void> {
		try {
			const refreshToken = await SecureStore.getItemAsync("refreshToken")
			if (refreshToken) {
				await api.post("/auth/logout/", { refresh: refreshToken })
			}
		} catch (error) {
			// ignore logout errors & proceed to clear tokens
			console.error("Logout error:", error)
		} finally {
			await SecureStore.deleteItemAsync("accessToken")
			await SecureStore.deleteItemAsync("refreshToken")
			await SecureStore.deleteItemAsync("user")
			await SecureStore.deleteItemAsync("userId")
		}
	}

	/** Get stored user info */
	async getCurrentUser(): Promise<MappedUser | null> {
		try {
			const userData = await SecureStore.getItemAsync("user")
			return userData ? JSON.parse(userData) : null
		} catch (error) {
			console.error("Error fetching user data:", error)
			return null
		}
	}

	/** Check if user is authenticated */
	async isAuthenticated(): Promise<boolean> {
		const accessToken = await SecureStore.getItemAsync("accessToken")
		const refreshToken = await SecureStore.getItemAsync("refreshToken")

		return Boolean(accessToken && refreshToken)
	}
}

export default new AuthAPI()
