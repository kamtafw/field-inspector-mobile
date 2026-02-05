import { Database } from "@nozbe/watermelondb"
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite"
import schema from "./schema"
import migrations from "./migrations"

import InspectionTemplate from "./models/InspectionTemplate"
import SyncOperation from "./models/SyncOperation"
import Inspection from "./models/Inspection"
import Conflict from "./models/Conflict"
import Photo from "./models/Photo"
import User from "./models/User"

const adapter = new SQLiteAdapter({
	schema,
	// migrations,
	jsi: true,
	onSetUpError: (error) => {
		console.error("Database setup error:", error)
	},
})

const database = new Database({
	adapter,
	modelClasses: [User, InspectionTemplate, Inspection, SyncOperation, Conflict, Photo],
})

export default database
