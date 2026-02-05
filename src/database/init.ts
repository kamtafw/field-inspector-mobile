import { Database } from "@nozbe/watermelondb"
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite"
import schema from "./schema"
import migrations from "./migrations"
import Inspection from "./models/Inspection"
import SyncOperation from "./models/SyncOperation"
import Conflict from "./models/Conflict"
import User from "./models/User"
import InspectionTemplate from "./models/InspectionTemplate"
import Photo from "./models/Photo"

let database: Database | null = null

export async function initDatabase(): Promise<Database> {
	if (database) {
		return database
	}

	try {
		const adapter = new SQLiteAdapter({
			schema,
			// migrations,
			jsi: true,
			onSetUpError: (error) => {
				console.error("Database setup error:", error)
				throw error
			},
		})

		database = new Database({
			adapter,
			modelClasses: [User, InspectionTemplate, Inspection, SyncOperation, Conflict, Photo],
		})

		console.log("✅ Database initialized")
		return database
	} catch (error) {
		console.error("❌ Database initialization failed:", error)
		database = null
		throw error
	}
}

export default database as any as Database
