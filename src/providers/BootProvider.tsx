import React, { createContext, useContext, useEffect, useState } from "react"
import BootManager, { BootStep, BootStepResult } from "../services/boot/BootManager"
import { DatabaseStep } from "../services/boot/steps/DatabaseStep"
import { AuthStep } from "../services/boot/steps/AuthStep"
import { NetworkStep } from "../services/boot/steps/NetworkStep"
import { AutoSyncStep } from "../services/boot/steps/AutoSyncStep"
import { NotificationStep } from "../services/boot/steps/NotificationStep"
import { AnalyticsStep } from "../services/boot/steps/AnalyticsStep"
import BootLoadingScreen from "../components/boot/BootLoadingScreen"
import BootErrorScreen from "../components/boot/BootErrorScreen"

export type BootStatus = "booting" | "ready" | "error"

interface BootContextValue {
	status: BootStatus
	currentStep: BootStep | null
	error: Error | null
	results: BootStepResult[]
	retry: () => Promise<void>
}

const BootContext = createContext<BootContextValue | null>(null)

export function useBootContext() {
	const context = useContext(BootContext)

	if (!context) {
		throw new Error("useBootContext must be used within BootProvider")
	}

	return context
}

export function BootProvider({ children }: { children: React.ReactNode }) {
	const [status, setStatus] = useState<BootStatus>("booting")
	const [currentStep, setCurrentStep] = useState<BootStep | null>(null)
	const [error, setError] = useState<Error | null>(null)
	const [results, setResults] = useState<BootStepResult[]>([])

	const initializeApp = async () => {
		try {
			setStatus("booting")
			setError(null)
			setCurrentStep(null)

			// register all initialization steps
			BootManager.clear()
			BootManager.registerStep(DatabaseStep)
			BootManager.registerStep(AuthStep)
			BootManager.registerStep(NetworkStep)
			BootManager.registerStep(AutoSyncStep)
			BootManager.registerStep(NotificationStep)
			BootManager.registerStep(AnalyticsStep)

			BootManager.onStepComplete((step, success) => {
				setCurrentStep(step)
			})

			// execute initialization
			const result = await BootManager.initialize()
			setResults(result.results)

			if (result.success) {
				setStatus("ready")
			} else {
				// find first error
				const failedStep = result.results.find((r) => !r.success)
				setError(failedStep?.error || new Error("Unknown initialization error"))
				setStatus("error")
			}
		} catch (err: any) {
			console.error("Fatal boot error:", err)
			setError(err)
			setStatus("error")
		}
	}

	useEffect(() => {
		initializeApp()
	}, [])

	const retry = async () => {
		await initializeApp()
	}

	// show loading screen
	if (status === "booting") {
		return <BootLoadingScreen currentStep={currentStep} />
	}

	// show error screen
	if (status === "error") {
		return <BootErrorScreen error={error} results={results} onRetry={retry} />
	}

	// app ready, render children
	return (
		<BootContext.Provider value={{ status, currentStep, error, results, retry }}>
			{children}
		</BootContext.Provider>
	)
}
