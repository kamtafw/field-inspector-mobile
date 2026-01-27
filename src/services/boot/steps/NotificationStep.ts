import { InitializationStep } from "../BootManager"

export const NotificationStep: InitializationStep = {
	name: "notifications",
	required: false, // app can run w/o notifications

	async execute() {
		// TODO: setup push notifications
		console.log("Notifications setup (not implemented yet)")
	},

	async rollback() {
		console.log("Notifications rollback")
	},
}
