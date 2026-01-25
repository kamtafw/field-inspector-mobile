import { Alert, Linking } from "react-native"
import ErrorHandler from "@/src/services/error/ErrorHandler"

class ErrorAlert {
	/** Show error alert with user-friendly message and actions */
	show(error: any, onRetry?: () => void): void {
		const { title, message, action, retryable } = ErrorHandler.handle(error)

		const buttons: any[] = []

		// add retry button if error is retryable
		if (retryable && onRetry) {
			buttons.push({
				text: action || "Retry",
				onPress: onRetry,
			})
		}

		// add settings button for permission errors
		if (action === "Open Settings") {
			buttons.push({
				text: "Open Settings",
				onPress: () => Linking.openSettings(),
			})
		}

		// add login button for auth errors
		if (action === "Log In") {
			buttons.push({
				text: "Log In",
				onPress: () => {
					// navigate to login - implement this based on your navigation
					console.log("Navigate to login screen")
				},
			})
		}

		// always add dismiss button
		buttons.push({
			text: retryable ? "Cancel" : "OK",
			style: "cancel",
		})

		Alert.alert(title, message, buttons)
	}

	/** Show a simple error toast (for less critical errors) */
	showToast(error: any): void {
		const message = ErrorHandler.getSimpleMessage(error)
		// TODO: implement toast notification
		console.log("Toast:", message)
	}

	/** Check if error should show a full alert vs toast */
	shouldShowAlert(error: any): boolean {
		// show alert for auth, permission, and conflict errors
		// show toast for network and validation errors
		const { title } = ErrorHandler.handle(error)
		return (
			title.includes("Session") ||
			title.includes("Permission") ||
			title.includes("Conflict") ||
			title.includes("Storage")
		)
	}
}

export default new ErrorAlert()
