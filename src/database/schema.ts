// WatermelonDB schema definition

import { appSchema, tableSchema } from "@nozbe/watermelondb"

export default appSchema({
	version: 3,
	tables: [
		tableSchema({
			name: "users",
			columns: [
				{ name: "email", type: "string", isIndexed: true },
				{ name: "name", type: "string" },
				{ name: "role", type: "string" }, // 'inspector' | 'manager'
				{ name: "last_sync_ts", type: "number", isOptional: true },
				{ name: "created_ts", type: "number" },
			],
		}),

		tableSchema({
			name: "inspection_templates",
			columns: [
				{ name: "remote_id", type: "string", isIndexed: true }, // server UUID
				{ name: "name", type: "string" },
				{ name: "version", type: "number" },
				{ name: "checklist_items", type: "string" }, // JSON array
				{ name: "synced_ts", type: "number" },
				{ name: "created_ts", type: "number" },
			],
		}),

		tableSchema({
			name: "inspections",
			columns: [
				{ name: "remote_id", type: "string", isOptional: true }, // null until synced
				{ name: "template_id", type: "string", isIndexed: true },
				{ name: "facility_name", type: "string" },
				{ name: "facility_address", type: "string" },

				{ name: "responses", type: "string" }, //JSON payload: {item_id: {value, notes}}

				{ name: "version", type: "number" },
				{ name: "inspector_id", type: "string", isIndexed: true },
				{ name: "status", type: "string", isIndexed: true }, // "draft" | "submitted" | "synced" | "conflict"

				{ name: "is_synced", type: "boolean" },
				{ name: "synced_ts", type: "number", isOptional: true },
				{ name: "sync_error", type: "string", isOptional: true },

				{ name: "created_ts", type: "number" },
				{ name: "updated_ts", type: "number" },
				{ name: "last_action_ts", type: "number" },
				{ name: "submitted_ts", type: "number", isOptional: true },
			],
		}),

		tableSchema({
			name: "sync_operations",
			columns: [
				{ name: "operation_type", type: "string", isIndexed: true }, // CREATE_INSPECTION | UPDATE_INSPECTION
				{ name: "entity_id", type: "string", isIndexed: true }, // local ID of inspection
				{ name: "entity_type", type: "string" }, // inspection | photo (not yet)
				{ name: "payload", type: "string" }, // JSON with all data needed to sync
				{ name: "idempotency_key", type: "string" },

				{ name: "status", type: "string", isIndexed: true }, // pending | in_progress | completed | failed
				{ name: "retry_count", type: "number" },
				{ name: "max_retries", type: "number" },
				{ name: "last_attempt_ts", type: "number", isOptional: true },
				{ name: "next_retry_ts", type: "number", isOptional: true },
				{ name: "error_message", type: "string", isOptional: true },

				{ name: "created_ts", type: "number" },
				{ name: "completed_ts", type: "number", isOptional: true },
			],
		}),

		tableSchema({
			name: "conflicts",
			columns: [
				{ name: "inspection_id", type: "string", isIndexed: true },
				{ name: "client_version", type: "number" },
				{ name: "server_version", type: "number" },

				{ name: "client_data", type: "string" },
				{ name: "server_data", type: "string" },
				{ name: "conflict_fields", type: "string" },

				{ name: "resolved", type: "boolean" },
				{ name: "resolution_strategy", type: "string", isOptional: true }, // keep_mine | keep_theirs | merge
				{ name: "resolved_ts", type: "number", isOptional: true },

				{ name: "created_ts", type: "number" },
			],
		}),
	],
})
