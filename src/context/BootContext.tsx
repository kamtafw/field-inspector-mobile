import React, { createContext, useEffect, useState } from "react"
import { BootState } from "./types"
import { initDatabase } from "../database/init"
import { useAuth } from "../hooks/useAuth"
import { AuthProvider } from "./AuthContext"
import { ActivityIndicator, View, Text } from "react-native"

const BootContext = createContext<BootState>({ status: "idle" })

export function BootProvider({ children }: { children: React.ReactNode }) {
	const [state, setState] = useState<BootState>({ status: "booting" })

	return (
		<AuthProvider>
			<BootContent state={state} setState={setState}>
				{children}
			</BootContent>
		</AuthProvider>
	)
}

function BootContent({
	state,
	setState,
	children,
}: {
	state: BootState
	setState: React.Dispatch<React.SetStateAction<BootState>>
	children: React.ReactNode
}) {
	const auth = useAuth()

	useEffect(() => {
		let cancelled = false

		async function boot() {
			try {
				await initDatabase()

				if (cancelled) return
				await auth!.restoreAuth()

				if (cancelled) return
				setState({ status: "ready" })
			} catch (err: any) {
				console.error("FATAL BOOT ERROR:", err)
				// TODO: persist error to file / AsyncStorage
				setState({ status: "fatal", error: err as Error })
			}
		}

		boot()

		return () => {
			cancelled = true
		}
	}, [])

	// <BootLoading /> or SplashScreen
	if (state.status === "booting") {
		return (
			<View className="flex-1 justify-center items-center bg-background">
				<ActivityIndicator size="large" color="#007AFF" />
				<Text className="mt-3 text-base text-[#666] font-bold">Initializing…</Text>
			</View>
		)
	}

	if (state.status === "fatal") {
		return
		// return "FATAL" // <FatalErrorScreen error={state.error} />
	}

	return <>{children}</>
}
