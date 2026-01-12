// Sync engine initialization

import SyncEngine from "../../sync/SyncEngine"
import { InitializationStep } from "../BootManager"

export const SyncStep: InitializationStep = {
	name: "sync",
	required: false, // app can run w/o sync

	async execute() {
		await SyncEngine.initialize()
		console.log("Sync engine initialized")
	},

	async rollback() {
		// stop sync engine if needed
		console.log("Sync engine stopped")
	},
}
