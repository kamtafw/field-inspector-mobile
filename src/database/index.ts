// Database initialization & export

import { Database } from "@nozbe/watermelondb"
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite"
import schema from "./schema"
import migrations from "./migrations"

import Inspection from "./models/Inspection"
import SyncOperation from "./models/SyncOperation"
import Conflict from "./models/Conflict"
import Photo from "./models/Photo"

// SQLite adapter to the underlying database
const adapter = new SQLiteAdapter({
	schema,
	// migrations,
	jsi: true /* Platform.OS === 'ios' */, // works for better performance
	onSetUpError: (error) => {
		console.error("Database setup error:", error)
	},
})

const database = new Database({
	adapter,
	modelClasses: [Inspection, SyncOperation, Conflict, Photo],
})

export default database
