export interface UserFriendlyError {
	title: string
	message: string
	action?: string
	retryable: boolean
}

class ErrorHandler {
	/** Convert any error into a user-friendly format */
	handle(error: any): UserFriendlyError {
		if (this.isNetworkError(error)) {
			return this.handleNetworkError(error)
		}

		if (this.isAuthError(error)) {
			return this.handleAuthError(error)
		}

		if (this.isStorageError(error)) {
			return this.handleStorageError(error)
		}

		if (this.isConflictError(error)) {
			return this.handleConflictError(error)
		}

		if (this.isPermissionError(error)) {
			return this.handlePermissionError(error)
		}

		if (this.isValidationError(error)) {
			return this.handleValidationError(error)
		}

		return this.handleUnknownError(error)
	}

	private isNetworkError(error: any): boolean {
		return (
			error.message?.includes("Network request failed") ||
			error.message?.includes("timeout") ||
			error.message?.includes("Network") ||
			error.code === "ECONNABORTED" ||
			error.code === "ETIMEDOUT" ||
			!error.response
		)
	}

	private handleNetworkError(error: any): UserFriendlyError {
		if (error.message?.includes("timeout")) {
			return {
				title: "Connection Timeout",
				message: "The request took too long. Check your internet connection and try again.",
				action: "Retry",
				retryable: true,
			}
		}

		return {
			title: "No Internet Connection",
			message:
				"Can't reach the server. Your changes are saved locally and will sync when you're back online.",
			action: "OK",
			retryable: true,
		}
	}

	private isAuthError(error: any): boolean {
		return error.response?.status === 401 || error.response?.status === 403
	}

	private handleAuthError(error: any): UserFriendlyError {
		if (error.response?.status === 401) {
			return {
				title: "Session Expired",
				message: "Your session has expired. Please log in again to continue.",
				action: "Log In",
				retryable: false,
			}
		}

		return {
			title: "Access Denied",
			message: "You don't have permission to perform this action.",
			action: "OK",
			retryable: false,
		}
	}

	private isStorageError(error: any): boolean {
		return (
			error.message?.includes("storage") ||
			error.message?.includes("disk") ||
			error.message?.includes("quota") ||
			error.code === "ENOSPC"
		)
	}

	private handleStorageError(error: any): UserFriendlyError {
		return {
			title: "Storage Full",
			message:
				"Your device is running low on storage. Free up some space to continue saving photos and inspections.",
			action: "OK",
			retryable: false,
		}
	}

	private isConflictError(error: any): boolean {
		return error.response?.status === 409 || error.message?.includes("conflict")
	}

	private handleConflictError(error: any): UserFriendlyError {
		return {
			title: "Conflict Detected",
			message:
				"This inspection was edited by someone else. Please review both versions and choose which changes to keep.",
			action: "Resolve",
			retryable: false,
		}
	}

	private isPermissionError(error: any): boolean {
		return (
			error.message?.includes("permission") ||
			error.message?.includes("denied") ||
			error.code === "EPERM"
		)
	}

	private handlePermissionError(error: any): UserFriendlyError {
		if (error.message?.includes("camera")) {
			return {
				title: "Camera Permission Required",
				message: "Please enable camera access in your device settings to take photos.",
				action: "Open Settings",
				retryable: false,
			}
		}

		if (error.message?.includes("photo") || error.message?.includes("library")) {
			return {
				title: "Photo Library Permission Required",
				message: "Please enable photo library access in your device settings.",
				action: "Open Settings",
				retryable: false,
			}
		}

		return {
			title: "Permission Denied",
			message: "This action requires permission. Please check your device settings.",
			action: "OK",
			retryable: false,
		}
	}

	private isValidationError(error: any): boolean {
		return error.response?.status === 400 || error.message?.includes("validation")
	}

	private handleValidationError(error: any): UserFriendlyError {
		const message =
			error.response?.data?.error ||
			error.response?.data?.message ||
			"Please check your input and try again."

		return {
			title: "Invalid Input",
			message,
			action: "OK",
			retryable: true,
		}
	}

	private handleUnknownError(error: any): UserFriendlyError {
		console.error("Unknown error:", error)

		return {
			title: "Something Went Wrong",
			message:
				"An unexpected error occurred. Your data is safe. Please try again or contact support if the problem persists.",
			action: "OK",
			retryable: true,
		}
	}

	/** Get a simple error message (for inline display) */
	getSimpleMessage(error: any): string {
		const handled = this.handle(error)
		return handled.message
	}

	/** Check if an error is retryable */
	isRetryable(error: any): boolean {
		return this.handle(error).retryable
	}
}

export default new ErrorHandler()
