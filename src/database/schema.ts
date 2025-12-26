import { appSchema, tableSchema } from "@nozbe/watermelondb"

export default appSchema({
	version: 1,
	tables: [
		// user table - stores logged-in user info
		tableSchema({
			name: "users",
			columns: [
				{ name: "email", type: "string", isIndexed: true },
				{ name: "name", type: "string" },
				{ name: "role", type: "string" }, // 'inspector' | 'manager'
				{ name: "last_sync_at", type: "number", isOptional: true },
				{ name: "created_at", type: "number" },
			],
		}),

		// inspections - core data, works offline
		tableSchema({
			name: "inspections",
			columns: [
				{ name: "remote_id", type: "string", isOptional: true }, // null until synced
				{ name: "template_id", type: "string", isIndexed: true },
				{ name: "facility_name", type: "string" },
				{ name: "facility_address", type: "string" },
				{ name: "responses", type: "string" }, //JSON: {item_id: {value, notes}}
				{ name: "status", type: "string", isIndexed: true }, // "draft" | "submitted" | "synced" | "conflict"
				{ name: "version", type: "number" },
				{ name: "created_at", type: "number" },
				{ name: "inspector_id", type: "string" },

				{ name: "is_synced", type: "boolean" },
				{ name: "synced_at", type: "number", isOptional: true },
				{ name: "synced_error", type: "string", isOptional: true },

				{ name: "submitted_at", type: "number", isOptional: true },
				{ name: "created_at", type: "number" },
				{ name: "updated_at", type: "number" },
			],
		}),
	],
})
