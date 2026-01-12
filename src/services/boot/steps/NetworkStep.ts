// Network monitoring initialization

import NetworkMonitor from "../../network/NetworkMonitor"
import { InitializationStep } from "../BootManager"

export const NetworkStep: InitializationStep = {
	name: "network",
	required: false, // app can run offline

	async execute() {
		NetworkMonitor.initialize()
		const status = NetworkMonitor.getStatus()
		console.log(`Network status: ${status}`)
	},

	async rollback() {
		// stop network monitoring if needed
		console.log("Network rollback (no-op)")
	},
}
