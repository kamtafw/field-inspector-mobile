import React, { useEffect, useState } from "react"
import { LoginCredentials } from "../services/api/auth.api"
import AuthService from "../services/auth/AuthService"

interface AuthContextType {
	isAuthenticated: boolean
	isReady: boolean
	userId: string
	login: (credentials: LoginCredentials) => Promise<void>
	logout: () => Promise<void>
}

export const AuthContext = React.createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [isAuthenticated, setIsAuthenticated] = useState(false)
	const [isReady, setIsReady] = useState(false)
	const [userId, setUserId] = useState("")

	useEffect(() => {
		const initializeAuth = async () => {
			const authenticated = await AuthService.isAuthenticated()
			setIsAuthenticated(authenticated)
			setIsReady(true)
		}

		initializeAuth()
	}, [])

	const login = async (credentials: LoginCredentials) => {
		const data = await AuthService.login(credentials)
		setUserId(data.user.id)

		// resume sync: SyncService.resume()

		// setUser(user)
		setIsAuthenticated(true)
	}

	const logout = async () => {
		await AuthService.logout()

		// stop sync: SyncService.pause()

		// clear in-memory state
		setIsAuthenticated(false)
		// setUser(null)
	}

	return (
		<AuthContext.Provider value={{ isAuthenticated, isReady, userId, login, logout }}>
			{children}
		</AuthContext.Provider>
	)
}
