// Orchestrates all initialization steps

export type BootStep = "database" | "auth" | "network" | "sync" | "notifications" | "analytics"

export interface BootStepResult {
	step: BootStep
	success: boolean
	error?: Error
	duration: number
}

export interface InitializationStep {
	name: BootStep
	required: boolean // if false, failure won't stop boot
	execute: () => Promise<void>
	rollback?: () => Promise<void> // cleanup on failure
}

class BootManager {
	private steps: InitializationStep[] = []
	private results: BootStepResult[] = []
	private listeners: Array<(step: BootStep, success: boolean) => void> = []

	/** Register an initialization step */
	registerStep(step: InitializationStep) {
		this.steps.push(step)
	}

	/** Execute all initialization steps in order */
	async initialize(): Promise<{ success: boolean; results: BootStepResult[] }> {
		console.log("🚀 Starting app initialization...")
		this.results = []

		for (const step of this.steps) {
			const startTime = Date.now()

			try {
				console.log(`⏳ Initializing: ${step.name}`)
				await step.execute()

				const duration = Date.now() - startTime
				const result: BootStepResult = {
					step: step.name,
					success: true,
					duration,
				}

				this.results.push(result)
				this.notifyListeners(step.name, true)

				console.log(`✅ ${step.name} initialized (${duration}ms)`)
			} catch (err: any) {
				const duration = Date.now() - startTime
				const result: BootStepResult = {
					step: step.name,
					success: false,
					error: err,
					duration,
				}

				this.results.push(result)
				this.notifyListeners(step.name, false)

				console.error(`❌ ${step.name} failed (${duration}ms):`, err)

				// if step is required, rollback and fail
				if (step.required) {
					console.error("🛑 Required step failed, rolling back...")
					await this.rollback()
					return { success: false, results: this.results }
				}

				// optional step failed, continue
				console.warn(`⚠️ Optional step ${step.name} failed, continuing...`)
			}
		}

		console.log("✅ App initialization complete")
		return { success: true, results: this.results }
	}

	/** Rollback initialization on failure */
	private async rollback() {
		console.log("🔄 Rolling back initialization...")

		// rollback in reverse order
		for (let i = this.results.length - 1; i >= 0; i--) {
			const result = this.results[i]
			if (!result.success) continue // skip failed steps

			const step = this.steps.find((s) => s.name === result.step)
			if (step?.rollback) {
				try {
					console.log(`↩️ Rolling back: ${step.name}`)
					await step.rollback()
				} catch (err) {
					console.error(`Failed to rollback ${step.name}:`, err)
				}
			}
		}
	}

	/** Subscribe to step completion */
	onStepComplete(callback: (step: BootStep, success: boolean) => void) {
		this.listeners.push(callback)
	}

	private notifyListeners(step: BootStep, success: boolean) {
		this.listeners.forEach((cb) => cb(step, success))
	}

	/** Get initialization results */
	getResults(): BootStepResult[] {
		return this.results
	}

	/** Clear all registered steps (for testing) */
	clear() {
		this.steps = []
		this.results = []
		this.listeners = []
	}
}

export default new BootManager()
