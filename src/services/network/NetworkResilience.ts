import NetInfo from "@react-native-community/netinfo"

interface RetryConfig {
	maxAttempts: number
	baseDelay: number
	maxDelay: number
	backoffMultiplier: number
}

const DEFAULT_CONFIG: RetryConfig = {
	maxAttempts: 3,
	baseDelay: 1000,
	maxDelay: 30000,
	backoffMultiplier: 2,
}

export class NetworkResilience {
	/**
	 * Execute function with automatic retries and exponential backoff
	 * Waits for network if offline
	 */
	static async withRetry<T>(fn: () => Promise<T>, config: Partial<RetryConfig> = {}): Promise<T> {
		const finalConfig = { ...DEFAULT_CONFIG, ...config }
		let lastError: any

		for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
			const netState = await NetInfo.fetch()

			if (!netState.isConnected) {
				throw new Error("No internet connection")
			}

			try {
				console.log(`🔄 Attempting operation (${attempt}/${finalConfig.maxAttempts})`)
				const result = await fn()

				if (attempt > 1) {
					console.log(`✅ Operation succeeded after ${attempt} attempts`)
				}

				return result
			} catch (err: any) {
				lastError = err
				console.error(`❌ Attempt ${attempt} failed:`, err.message)

				// don't retry client errors
				if (err.response?.status >= 400 && err.response?.status < 500) {
					throw err
				}

				// last attempt failed
				if (attempt === finalConfig.maxAttempts) {
					console.error(`❌ All ${finalConfig.maxAttempts} attempts failed`)
					throw lastError
				}

				// calculate delay with exponential backoff
				const delay = Math.min(
					finalConfig.baseDelay * Math.pow(finalConfig.backoffMultiplier, attempt - 1),
					finalConfig.maxDelay,
				)

				console.log(`⏳ Retrying in ${delay}ms...`)
				await this.sleep(delay)
			}
		}

		throw lastError
	}

	/**
	 * Sleep for specified milliseconds
	 */
	private static sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms))
	}
}
