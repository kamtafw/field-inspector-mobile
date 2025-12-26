import React, { useEffect, useState } from "react"
import authApi, { LoginCredentials } from "../services/api/auth.api"

interface AuthContextType {
	isAuthenticated: boolean
	isReady: boolean
	login: (credentials: LoginCredentials) => Promise<void>
	logout: () => Promise<void>
}

export const AuthContext = React.createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [isAuthenticated, setIsAuthenticated] = useState(false)
	const [isReady, setIsReady] = useState(false)

	useEffect(() => {
		const initializeAuth = async () => {
			const authenticated = await authApi.isAuthenticated()
			setIsAuthenticated(authenticated)
			setIsReady(true)
		}

		initializeAuth()
	}, [])

	const login = async (credentials: LoginCredentials) => {
		await authApi.login(credentials)

		// resume sync: SyncService.resume()

		// setUser(user)
		setIsAuthenticated(true)
	}

	const logout = async () => {
		await authApi.logout()

		// stop sync: SyncService.pause()

		// clear in-memory state
		setIsAuthenticated(false)
		// setUser(null)
	}

	return (
		<AuthContext.Provider value={{ isAuthenticated, isReady, login, logout }}>
			{children}
		</AuthContext.Provider>
	)
}
