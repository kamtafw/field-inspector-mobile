import React, { createContext, useContext, useEffect, useState } from "react"
import { LoginCredentials } from "../services/api/auth.api"
import AuthService from "../services/auth/AuthService"
import { getRestoredAuth } from "../services/boot/steps/AuthStep"
import SyncEngine from "../services/sync/SyncEngine"
import { onLogout } from "../services/api/client"
import { Alert } from "react-native"

interface AuthContextValue {
	isAuthenticated: boolean
	userId: string | null
	login: (credentials: LoginCredentials) => Promise<void>
	logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
	const context = useContext(AuthContext)

	if (!context) {
		throw new Error("useAuth must be used within AuthProvider")
	}

	return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [isAuthenticated, setIsAuthenticated] = useState(false)
	const [userId, setUserId] = useState<string | null>(null)

	// restore auth from boot step
	useEffect(() => {
		const restored = getRestoredAuth()
		if (restored) {
			setIsAuthenticated(restored.isAuthenticated)
			setUserId(restored.userId)
		}
	}, [])

	// listen for automatic logout (token refresh failed)
	useEffect(() => {
		const unsubscribe = onLogout(() => {
			console.log("🚪 Automatic logout triggered")

			setIsAuthenticated(false)
			setUserId(null)

			Alert.alert("Session Expired", "Your session has expired. Please log in again.", [
				{ text: "OK" },
			])
		})

		return unsubscribe
	}, [])

	const login = async (credentials: LoginCredentials) => {
		const data = await AuthService.login(credentials)
		setIsAuthenticated(true)
		setUserId(data.user.id)

		// resume sync after login
		await SyncEngine.process()
	}

	const logout = async () => {
		await AuthService.logout()
		setIsAuthenticated(false)
		setUserId(null)
	}

	return (
		<AuthContext.Provider value={{ isAuthenticated, userId, login, logout }}>
			{children}
		</AuthContext.Provider>
	)
}
