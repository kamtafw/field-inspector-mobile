import React, { createContext, useContext, useEffect, useState } from "react"
import { LoginCredentials, SignupCredentials } from "../services/api/auth.api"
import AuthService from "../services/auth/AuthService"
import { getRestoredAuth } from "../services/boot/steps/AuthStep"
import { onLogout } from "../services/api/client"
import { Alert } from "react-native"
import AutoSyncService from "../services/sync/AutoSyncService"

interface AuthContextValue {
	isAuthenticated: boolean
	userId: string | null
	userEmail: string | null
	userName: string | null
	signup: (credentials: SignupCredentials) => Promise<void>
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
	const [userEmail, setUserEmail] = useState<string | null>(null)
	const [userName, setUserName] = useState<string | null>(null)

	// restore auth from boot step
	useEffect(() => {
		const restored = getRestoredAuth()
		if (restored) {
			setIsAuthenticated(restored.isAuthenticated)
			setUserId(restored.userId)

			AuthService.getCurrentUser().then((user) => {
				if (user) {
					setUserEmail(user.email)
					setUserName(`${user.firstName} ${user.lastName}`)
				}
			})
		}
	}, [])

	// listen for automatic logout (token refresh failed)
	useEffect(() => {
		const unsubscribe = onLogout(() => {
			console.log("🚪 Automatic logout triggered")

			setIsAuthenticated(false)
			setUserId(null)
			setUserEmail(null)
			setUserName(null)

			Alert.alert("Session Expired", "Your session has expired. Please log in again.", [
				{ text: "OK" },
			])
		})

		return unsubscribe
	}, [])

	const signup = async (credentials: SignupCredentials) => {
		const user = await AuthService.signup(credentials)

		setIsAuthenticated(true)
		setUserId(user.id)
		setUserEmail(user.email)
		setUserName(`${user.firstName} ${user.lastName}`)

		await AutoSyncService.syncNow()
	}

	const login = async (credentials: LoginCredentials) => {
		const user = await AuthService.login(credentials)

		setIsAuthenticated(true)
		setUserId(user.id)
		setUserEmail(user.email)
		setUserName(`${user.firstName} ${user.lastName}`)

		await AutoSyncService.syncNow()
	}

	const logout = async () => {
		await AuthService.logout()

		setIsAuthenticated(false)
		setUserId(null)
		setUserEmail(null)
		setUserName(null)
	}

	return (
		<AuthContext.Provider
			value={{ isAuthenticated, userId, userEmail, userName, signup, login, logout }}
		>
			{children}
		</AuthContext.Provider>
	)
}
