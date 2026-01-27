import NetworkMonitor from "../../network/NetworkMonitor"
import { InitializationStep } from "../BootManager"

export const NetworkStep: InitializationStep = {
	name: "network",
	required: false, // app can run offline

	async execute() {
		NetworkMonitor.initialize()
		const status = NetworkMonitor.getStatus()
	},

	async rollback() {
		// stop network monitoring if needed
		console.log("Network rollback (no-op)")
	},
}
