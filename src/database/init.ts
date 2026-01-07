import { Database } from "@nozbe/watermelondb"
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite"
import schema from "./schema"
import migrations from "./migrations"
import Inspection from "./models/Inspection"
import SyncOperation from "./models/SyncOperations"

let database: Database | null = null

export async function initDatabase(): Promise<Database> {
	if (database) return database

	try {
		const adapter = new SQLiteAdapter({
			schema,
			// migrations,
			onSetUpError: (error) => {
				throw error
			},
		})

		database = new Database({ adapter, modelClasses: [Inspection, SyncOperation] })

		return database
	} catch (error) {
		console.error("Database Initialization Error:", error)
		database = null
		throw error
	}
}
