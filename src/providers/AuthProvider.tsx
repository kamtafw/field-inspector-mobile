import React, { createContext, useContext, useEffect, useState } from "react"
import { LoginCredentials } from "../services/api/auth.api"
import AuthService from "../services/auth/AuthService"
import { getRestoredAuth } from "../services/boot/steps/AuthStep"
import SyncEngine from "../services/sync/SyncEngine"

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

	const login = async (credentials: LoginCredentials) => {
		const data = await AuthService.login(credentials)
		setIsAuthenticated(true)
		setUserId(data.user.id)

		// resume sync after login
		// await SyncEngine.process()
	}

	const logout = async () => {
		await AuthService.logout()
		setIsAuthenticated(false)
		setUserId(null)

		// stop sync on logout
		// (SyncEngine will handle this automatically when no user)
	}

	return (
		<AuthContext.Provider value={{ isAuthenticated, userId, login, logout }}>
			{children}
		</AuthContext.Provider>
	)
}
