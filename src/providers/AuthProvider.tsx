import React, { createContext, useContext, useEffect, useState } from "react"
import { Alert } from "react-native"
import * as SecureStore from "expo-secure-store"

import { onLogout } from "../services/api/client"
import { getRestoredAuth } from "../services/boot/steps/AuthStep"
import AuthService from "../services/auth/AuthService"
import AutoSyncService from "../services/sync/AutoSyncService"
import NetworkMonitor from "../services/network/NetworkMonitor"
import AuthAPI, { LoginCredentials, SignupCredentials } from "../services/api/auth.api"
import TemplateValidation from "../services/template/TemplateValidation"

interface AuthContextValue {
	isAuthenticated: boolean
	userId: string | null
	userEmail: string | null
	userName: string | null
	userRole: string | null
	signup: (credentials: SignupCredentials) => Promise<void>
	login: (credentials: LoginCredentials) => Promise<void>
	logout: (clearLocalData: boolean) => Promise<void>
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
	const [userRole, setUserRole] = useState<string | null>(null)

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
					setUserRole(user.role)
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
			setUserRole(null)

			Alert.alert("Session Expired", "Your session has expired. Please log in again.", [
				{ text: "OK" },
			])
		})

		return unsubscribe
	}, [])

	NetworkMonitor.addListener(async (status) => {
		if (status === "online") {
			const needsRefresh = await SecureStore.getItemAsync("needsTokenRefresh")
			if (needsRefresh === "true") {
				try {
					const refreshToken = await SecureStore.getItemAsync("refreshToken")
					await AuthAPI.refreshToken(refreshToken!)
					await SecureStore.deleteItemAsync("needsTokenRefresh")
				} catch {
					Alert.alert("Session Expired", "Please log in again to sync your work", [
						{ text: "Log In", onPress: () => logout(false) },
					])
				}
			}
		}
	})

	const signup = async (credentials: SignupCredentials) => {
		const user = await AuthService.signup(credentials)

		setIsAuthenticated(true)
		setUserId(user.id)
		setUserEmail(user.email)
		setUserName(`${user.firstName} ${user.lastName}`)
		setUserRole(user.role)

		TemplateValidation.prefetchTemplates().catch((err) => {
			console.warn("Failed to prefetch templates:", err)
		})

		await AutoSyncService.syncNow()
	}

	const login = async (credentials: LoginCredentials) => {
		const user = await AuthService.login(credentials)

		setIsAuthenticated(true)
		setUserId(user.id)
		setUserEmail(user.email)
		setUserName(`${user.firstName} ${user.lastName}`)
		setUserRole(user.role)

		TemplateValidation.prefetchTemplates().catch((err) => {
			console.warn("Failed to prefetch templates:", err)
		})

		await AutoSyncService.syncNow()
	}

	const logout = async (clearLocalData: boolean = true) => {
		await AuthService.logout(clearLocalData)

		setIsAuthenticated(false)
		setUserId(null)
		setUserEmail(null)
		setUserName(null)
		setUserRole(null)
	}

	return (
		<AuthContext.Provider
			value={{ isAuthenticated, userId, userEmail, userName, userRole, signup, login, logout }}
		>
			{children}
		</AuthContext.Provider>
	)
}
