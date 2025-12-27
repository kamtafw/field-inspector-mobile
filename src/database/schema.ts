// WatermelonDB schema definition

import { appSchema, tableSchema } from "@nozbe/watermelondb"

export default appSchema({
	version: 1,
	tables: [
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

		tableSchema({
			name: "inspections",
			columns: [
				{ name: "facility_name", type: "string" },
				{ name: "status", type: "string", isIndexed: true }, // "draft" | "submitted" | "synced" | "conflict"
				{ name: "is_synced", type: "boolean" },
				{ name: "created_at", type: "number" },
				{ name: "updated_at", type: "number" },

				// { name: "remote_id", type: "string", isOptional: true }, // null until synced
				// { name: "template_id", type: "string", isIndexed: true },
				// { name: "facility_address", type: "string" },

				// { name: "responses", type: "string" }, //JSON: {item_id: {value, notes}}

				// { name: "version", type: "number" },
				// { name: "inspector_id", type: "string" },

				// { name: "synced_error", type: "string", isOptional: true },
				// { name: "synced_at", type: "number", isOptional: true },

				// { name: "submitted_at", type: "number", isOptional: true },
			],
		}),
	],
})
