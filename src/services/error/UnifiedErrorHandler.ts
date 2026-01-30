import { Alert, Linking } from "react-native"

export interface ErrorInfo {
	title: string
	message: string
	severity: "error" | "warning" | "info"
	retryable: boolean
	action?: "retry" | "settings" | "login" | "dismiss"
}

class UnifiedErrorHandler {
	private toastListeners: Array<(error: ErrorInfo) => void> = []

	/** Handle any error and return user-friendly info */
	handle(error: any): ErrorInfo {
		// network errors
		if (this.isNetworkError(error)) {
			return {
				title: "No Connection",
				message: "Check your internet connection and try again",
				severity: "warning",
				retryable: true,
				action: "retry",
			}
		}

		// auth errors (401, 403)
		if (error.response?.status === 401) {
			return {
				title: "Session Expired",
				message: "Your session has expired. Please log in again to continue.",
				severity: "error",
				retryable: false,
				action: "login",
			}
		}

		if (error.response?.status === 403) {
			return {
				title: "Access Denied",
				message: "You don't have permission for this action",
				severity: "error",
				retryable: false,
				action: "dismiss",
			}
		}

		// conflict errors (409)
		if (error.response?.status === 409) {
			return {
				title: "Conflict Detected",
				message: "This was edited elsewhere. Please resolve the conflict.",
				severity: "warning",
				retryable: false,
				action: "dismiss",
			}
		}

		// validation errors (400)
		if (error.response?.status === 400) {
			const serverMessage = error.response?.data?.message || error.response?.data?.error
			return {
				title: "Invalid Input",
				message: serverMessage || "Please check your input and try again",
				severity: "warning",
				retryable: true,
				action: "dismiss",
			}
		}

		// server errors (500+)
		if (error.response?.status >= 500) {
			return {
				title: "Server Error",
				message: "Something went wrong on our end. Please try again later.",
				severity: "error",
				retryable: true,
				action: "retry",
			}
		}

		// storage errors
		if (error.message?.includes("storage") || error.message?.includes("ENOSPC")) {
			return {
				title: "Storage Full",
				message: "Your device is low on storage. Please free up some space.",
				severity: "error",
				retryable: false,
				action: "settings",
			}
		}

		// permission errors
		if (error.message?.includes("permission")) {
			return {
				title: "Permission Required",
				message: "Please enable permissions in settings",
				severity: "warning",
				retryable: false,
				action: "settings",
			}
		}

		// generic error
		return {
			title: "Error",
			message: error.message || "Something went wrong. Please try again.",
			severity: "error",
			retryable: true,
			action: "retry",
		}
	}

	/** Show error as Alert dialog (for critical errors) or Toast (for non-critical errors) */
	showError(error: any, onRetry?: () => void) {
		const info = this.handle(error)

		if (this.shouldShowAlert(error)) {
			this.showAlert(error, onRetry)
		} else {
			this.showToast(error)
		}
	}

	/** Show error as Alert dialog (for critical errors) */
	showAlert(error: any, onRetry?: () => void) {
		const info = this.handle(error)

		const buttons: any[] = []

		if (info.action === "retry" && onRetry) {
			buttons.push({ text: "Retry", onPress: onRetry })
		}

		if (info.action === "settings") {
			buttons.push({
				text: "Open Settings",
				onPress: () => Linking.openSettings(),
			})
		}

		if (info.action === "login") {
			buttons.push({
				text: "Log In",
				onPress: () => {
					// Navigate to login
				},
			})
		}

		buttons.push({ text: "OK", style: "cancel" })

		Alert.alert(info.title, info.message, buttons)
	}

	/** Show error as Toast (for non-critical errors) */
	showToast(error: any) {
		const info = this.handle(error)
		this.notifyToastListeners(info)
	}

	/** Determine if error should be Alert vs Toast */
	shouldShowAlert(error: any): boolean {
		const info = this.handle(error)
		// show alert for errors and critical warnings
		return info.severity === "error" || info.action === "login"
	}

	/** Add toast listener (for UI component to subscribe) */
	onToast(callback: (error: ErrorInfo) => void) {
		this.toastListeners.push(callback)
		return () => {
			this.toastListeners = this.toastListeners.filter((cb) => cb !== callback)
		}
	}

	private notifyToastListeners(error: ErrorInfo) {
		this.toastListeners.forEach((cb) => cb(error))
	}

	private isNetworkError(error: any): boolean {
		return (
			!error.response ||
			error.message?.includes("Network") ||
			error.message?.includes("timeout") ||
			error.code === "ECONNABORTED" ||
			error.code === "ETIMEDOUT" ||
			!error.response
		)
	}
}

export default new UnifiedErrorHandler()
