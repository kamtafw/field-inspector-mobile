import * as SecureStore from "expo-secure-store"
import AuthAPI, { SignupCredentials, LoginCredentials, MappedUser } from "../api/auth.api"
import UserRepository from "@/src/database/repositories/UserRepository"
import User from "@/src/database/models/User"
import database from "@/src/database"

class AuthService {
	async signup(credentials: SignupCredentials) {
		const response = await AuthAPI.signup(credentials)

		const user = await UserRepository.create(response.user)

		return user
	}

	// Login user
	async login(credentials: LoginCredentials) {
		const response = await AuthAPI.login(credentials)
		const user = await UserRepository.create(response.user)
		return user
	}

	// logout user and clear local data
	async logout(clearLocalData: boolean = true) {
		await AuthAPI.logout()

		// wait a moment for subscriptions to clean up
		await new Promise((resolve) => setTimeout(resolve, 100))

		if (!clearLocalData) {
			await SecureStore.deleteItemAsync("accessToken")
			await SecureStore.deleteItemAsync("refreshToken")
		} else {
			await database.write(async () => {
				await database.unsafeResetDatabase()
			})
		}
	}

	// get current user (from local DB if offline)
	async getCurrentUser(): Promise<User | MappedUser | null> {
		try {
			const localUsers = await UserRepository.collection.query().fetch()

			if (localUsers.length > 0) {
				return localUsers.at(0) || null
			}

			throw new Error()
		} catch {
			return await AuthAPI.getCurrentUser()
		}
	}

	// check authentication status
	async isAuthenticated() {
		return await AuthAPI.isAuthenticated()
	}
}

export default new AuthService()
