import * as FileSystem from "expo-file-system/legacy"
import { initDatabase } from "@/src/database/init"
import { InitializationStep } from "../BootManager"

export const DatabaseStep: InitializationStep = {
	name: "database",
	required: true,

	async execute() {
		try {
			await this.validateEnvironment()
			const db = await initDatabase()
			await this.validateDatabase(db)

			console.log("✅ Database initialized and validated")
		} catch (err: any) {
			console.error("❌ Database initialization failed:", err)

			const recovered = await this.attemptRecovery!(err)

			if (!recovered) {
				throw new Error(`Database failed to initialize: ${err?.message || "Unknown cause"}`)
			}

			console.log("✅ Database reset & recovered")
		}
	},

	async rollback() {
		console.log("🔄 Rolling back database initialization...")
	},

	async validateEnvironment() {
		const info = await FileSystem.getInfoAsync(FileSystem.documentDirectory!)

		if (!info.exists) {
			throw new Error("App storage not available")
		}

		const freeSpace = await FileSystem.getFreeDiskStorageAsync()
		const MIN_REQUIRED_SPACE = 100 * 1024 * 1024 // 100MB

		if (freeSpace < MIN_REQUIRED_SPACE) {
			throw new Error(
				`Insufficient storage: ${(freeSpace / 1024 / 1024).toFixed(2)}MB available; ${MIN_REQUIRED_SPACE / 1024 / 1024}MB required`,
			)
		}
	},

	async validateDatabase(db: any) {
		try {
			const testCollection = db.get("inspections")
			await testCollection.query().fetchCount()

			console.log("✅ Database validation passed")
		} catch (error) {
			throw new Error(`Database validation failed: ${error}`)
		}
	},

	async attemptRecovery(error: any): Promise<boolean> {
		try {
			console.log("🔧 Attempting database recovery...")
			const issues = ["migration", "schema", "corrupt", "malformed"]
			const errorContainsAny = issues.some((issue) => error.message?.includes(issue))

			if (errorContainsAny) {
				console.log("Detected database issues")
				await initDatabase()
				return true
			}

			return false
		} catch {
			return false
		}
	},
}
