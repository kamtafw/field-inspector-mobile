export class AppError extends Error {
	constructor(
		message: string,
		public code: string,
		public recoverable: boolean = true,
		public userMessage?: string
	) {
		super(message)
		this.name = "AppError"
	}
}

export class NetworkError extends AppError {
	constructor(message: string = "Network connection lost") {
		super(
			message,
			"NETWORK_ERROR",
			true,
			"Unable to connect to the server. Please check your internet connection."
		)
	}
}

export class SyncConflictError extends AppError {
	constructor(public conflicts: any[], public inspectionId: string) {
		super(
			"Sync conflict detected",
			"SYNC_CONFLICT",
			true,
			"This inspection was modified elsewhere. Please resolve the conflict."
		)
	}
}

export class StorageFullError extends AppError {
	constructor() {
		super(
			"Device storage full",
			"STORAGE_FULL",
			false,
			"Your device is running out of storage. Please free up space."
		)
	}
}

export class AuthenticationError extends AppError {
	constructor(message: string = "Authentication failed") {
		super(message, "AUTH_ERROR", true, "Your session has expired. Please log in again.")
	}
}

export class ValidationError extends AppError {
	constructor(public field: string, message: string) {
		super(message, "VALIDATION_ERROR", true, message)
	}
}

export class ServerError extends AppError {
	constructor(statusCode: number, message: string) {
		super(
			message,
			"SERVER_ERROR",
			statusCode < 500, // 4xx are recoverable, 5xx are not
			"Something went wrong on our end. Please try again later."
		)
	}
}
