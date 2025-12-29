import React, { useState } from "react"
import { LoginCredentials } from "../services/api/auth.api"
import AuthService from "../services/auth/AuthService"

interface AuthContextType {
	isAuthenticated: boolean
	userId: string | null
	restoreAuth: () => Promise<void>
	login: (credentials: LoginCredentials) => Promise<void>
	logout: () => Promise<void>
}

export const AuthContext = React.createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [isAuthenticated, setIsAuthenticated] = useState(false)
	const [userId, setUserId] = useState<string | null>(null)

	const restoreAuth = async () => {
		const isAuthenticated = await AuthService.isAuthenticated()
		const user = await AuthService.getCurrentUser()

		if (isAuthenticated && !!user) {
			setIsAuthenticated(isAuthenticated)
			setUserId(user.id)
		}
	}

	const login = async (credentials: LoginCredentials) => {
		const data = await AuthService.login(credentials)
		setIsAuthenticated(true)
		setUserId(data.user.id)

		// resume sync: SyncService.resume()

		// setUser(user)
	}

	const logout = async () => {
		await AuthService.logout()
		setIsAuthenticated(false)
		setUserId(null)

		// stop sync: SyncService.pause()

		// clear in-memory state
	}

	return (
		<AuthContext.Provider value={{ isAuthenticated, userId, restoreAuth, login, logout }}>
			{children}
		</AuthContext.Provider>
	)
}
