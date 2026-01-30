import { Alert } from "react-native"

export class CircuitBreaker {
	private failureCount = 0
	private lastFailureTime = 0
	private state: "closed" | "open" | "half-open" = "closed"

	private readonly FAILURE_THRESHOLD = 5
	private readonly TIMEOUT = 60000

	async execute<T>(fn: () => Promise<T>): Promise<T> {
		if (this.state === "open") {
			const now = Date.now()

			if (now - this.lastFailureTime > this.TIMEOUT) {
				console.log("🔄 Circuit breaker: Attempting half-open state")
				this.state = "half-open"
			} else {
				throw new Error(
					`Circuit breaker OPEN. Server appears down. Will retry in ${Math.ceil(
						(this.TIMEOUT - (now - this.lastFailureTime)) / 1000,
					)} seconds.`,
				)
			}
		}

		try {
			const result = await fn()

			if (this.state === "half-open") {
				console.log("✅ Circuit breaker: Closing after successful request")
				this.state = "closed"
				this.failureCount = 0
			}

			return result
		} catch (error) {
			this.failureCount++
			this.lastFailureTime = Date.now()

			if (this.failureCount >= this.FAILURE_THRESHOLD) {
				console.log("🔴 Circuit breaker: OPENED due to repeated failures")
				this.state = "open"

				Alert.alert(
					"Server Temporarily Unavailable",
					"The server appears to be down. We'll pause sync attempts for 1 minute.",
					[{ text: "OK" }],
				)
			}

			throw error
		}
	}

	getState() {
		return this.state
	}

	reset() {
		this.state = "closed"
		this.failureCount = 0
	}
}
