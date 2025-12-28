// High-level auth service (combines API + local storage)

import { usersCollection } from "@/src/database/collections"
import AuthAPI, { LoginCredentials } from "../api/auth.api"

class AuthService {
	// Login user
	async login(credentials: LoginCredentials) {
		const response = await AuthAPI.login(credentials)

		// TODO: store user in local DB for offline access
		// await database.write(async () => {
		// 	await usersCollection.create((user: any) => {
		// 		user._raw.id = response.user.id // use server ID
		// 		user.email = response.user.email
		// 		user.name = response.user.name
		// 		user.role = response.user.role
		// 		user.lastSyncAt = Date.now()
		// 	})
		// })

		return response
	}

	// logout user and clear local data
	async logout() {
		await AuthAPI.logout()

		// TODO: select logout semantics
		// 1. Soft logout (keep data, lock access
		// 2. Nuclear logout (wipe everything)
		// 3. Account-bound wipe (conditional)
	}

	// get current user (from local DB if offline)
	async getCurrentUser() {
		// try local DB first
		const localUsers = await usersCollection.query().fetch()

		if (localUsers.length > 0) {
			return localUsers.at(0)
		}

		// fallback to SecureStore
		return await AuthAPI.getCurrentUser()
	}

	// check authentication status
	async isAuthenticated() {
		return await AuthAPI.isAuthenticated()
	}
}

export default new AuthService()
