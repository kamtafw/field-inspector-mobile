// Analytics initialization (optional)

import { InitializationStep } from "../BootManager"

export const AnalyticsStep: InitializationStep = {
	name: "analytics",
	required: false, // app can run w/o analytics

	async execute() {
		// TODO: initialize analytics (Mixpanel, Amplitude, etc.)
		console.log("Analytics setup (not implemented yet)")
	},

	async rollback() {
		console.log("Analytics rollback")
	},
}
