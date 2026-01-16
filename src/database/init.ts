import { Database } from "@nozbe/watermelondb"
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite"
import schema from "./schema"
import migrations from "./migrations"
import Inspection from "./models/Inspection"
import SyncOperation from "./models/SyncOperation"
import Conflict from "./models/Conflict"

let database: Database | null = null

export async function initDatabase(): Promise<Database> {
	if (database) {
		console.log("Database already initialized")
		return database
	}

	try {
		console.log("Initializing database...")

		const adapter = new SQLiteAdapter({
			schema,
			// migrations,
			jsi: true, // JSI for better performance
			onSetUpError: (error) => {
				console.error("Database setup error:", error)
				throw error
			},
		})

		database = new Database({
			adapter,
			modelClasses: [Inspection, SyncOperation, Conflict],
		})

		console.log("✅ Database initialized successfully")
		return database
	} catch (error) {
		console.error("❌ Database initialization failed:", error)
		database = null
		throw error
	}
}

export function getDatabase(): Database {
	if (!database) {
		throw new Error("Database not initialized. Call initDatabase() first.")
	}

	return database
}

export { database }
