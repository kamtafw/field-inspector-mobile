// Database initialization step

import { initDatabase } from "@/src/database/init"
import { InitializationStep } from "../BootManager"

export const DatabaseStep: InitializationStep = {
	name: "database",
	required: true, // app cannot run w/o database

	async execute() {
		await initDatabase()
		console.log("Database initialized successfully")
	},

	async rollback() {
		// close database connections if needed
		// NOTE: WatermelonDB doesn't require explicit cleanup
		console.log("Database rollback (no-op for WatermelonDB)")
	},
}
