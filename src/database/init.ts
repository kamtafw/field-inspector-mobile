import { Database } from "@nozbe/watermelondb"
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite"
import schema from "./schema"
import migrations from "./migrations"
import Inspection from "./models/Inspection"

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

		database = new Database({ adapter, modelClasses: [Inspection] })

		return database
	} catch (error) {
		database = null
		throw error
	}
}
