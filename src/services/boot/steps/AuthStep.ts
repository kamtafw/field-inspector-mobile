// Authentication restoration step

import AuthService from "../../auth/AuthService"
import { InitializationStep } from "../BootManager"

let restoredAuth: { isAuthenticated: boolean; userId: string | null } | null = null

export const AuthStep: InitializationStep = {
	name: "auth",
	required: false, // app can run w/o auth (show login screen)

	async execute() {
		const isAuthenticated = await AuthService.isAuthenticated()
		const user = isAuthenticated ? await AuthService.getCurrentUser() : null

		restoredAuth = {
			isAuthenticated,
			userId: user?.id || null,
		}

		if (isAuthenticated && user) {
			console.log(`Restored auth for userL ${user.id}`)
		} else {
			console.log("No existing auth session")
		}
	},

	async rollback() {
		restoredAuth = null
	},
}

export function getRestoredAuth() {
	return restoredAuth
}
