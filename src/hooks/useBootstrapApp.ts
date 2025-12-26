import { useEffect, useState } from "react"
import * as SecureStore from "expo-secure-store"
import authApi from "../services/api/auth.api"

export const useBootstrapApp = () => {
	const [ready, setReady] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [user, setUser] = useState<any>(null)

	useEffect(() => {
		const init = async () => {
			try {
				console.log("Bootstrapping App... ")

				const accessToken = await SecureStore.getItemAsync("accessToken")
				const refreshToken = await SecureStore.getItemAsync("refreshToken")

				if (accessToken && refreshToken) {
					const userInfo = await authApi.getCurrentUser()
					setUser(userInfo)

					setReady(true)
				}

				console.log("Bootstrap Complete.")
			} catch (err: any) {
				console.error("Bootstrap Error")
				setError("Failed to initialize app.")
				setReady(true) // avoid infinite loading
			}
		}

		init()
	}, [])

	return { ready, error, user }
}
