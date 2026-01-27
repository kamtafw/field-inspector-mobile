import AutoSyncService from "../../sync/AutoSyncService"
import { InitializationStep } from "../BootManager"

export const AutoSyncStep: InitializationStep = {
	name: "sync",
	required: false,

	async execute() {
		await AutoSyncService.initialize()
		console.log("Auto-sync initialized")
	},

	async rollback() {
		console.log("🔄 Auto-sync stopped")
	},
}
