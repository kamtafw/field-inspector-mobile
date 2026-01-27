import { BootStepResult } from "@/src/services/boot/BootManager"
import { Alert, Linking, ScrollView, Text, TouchableOpacity, View } from "react-native"

interface BootErrorScreenProps {
	error: Error | null
	results: BootStepResult[]
	onRetry: () => void
}

export default function BootErrorScreen({ error, results, onRetry }: BootErrorScreenProps) {
	const failedStep = results.find((r) => !r.success)

	const getErrorGuidance = () => {
		const errorMsg = error?.message || failedStep?.error?.message || ""

		// database errors
		if (errorMsg.includes("database") || errorMsg.includes("Database")) {
			if (errorMsg.includes("storage") || errorMsg.includes("Storage")) {
				return {
					title: "Storage Issue",
					message: "Your device is running low on storage space.",
					actions: [
						{ label: "Free Up Space", action: () => openStorageSettings() },
						{ label: "Retry", action: onRetry },
					],
				}
			}

			if (errorMsg.includes("permission") || errorMsg.includes("Permission")) {
				return {
					title: "Permission Required",
					message: "The app needs storage permission to function.",
					actions: [
						{ label: "Open Settings", action: () => Linking.openSettings() },
						{ label: "Retry", action: onRetry },
					],
				}
			}

			return {
				title: "Database Error",
				message: "The app's database couldn't initialize. Your data is safe.",
				actions: [
					{ label: "Retry", action: onRetry },
					{ label: "Reset Database", action: () => confirmDatabaseReset() },
				],
			}
		}

		// network errors
		if (failedStep?.step === "network") {
			return {
				title: "Network Setup Failed",
				message: "Network monitoring couldn't start. The app will work offline.",
				actions: [{ label: "Continue Anyway", action: onRetry }],
			}
		}

		// auth errors
		if (failedStep?.step === "auth") {
			return {
				title: "Authentication Issue",
				message: "Couldn't restore your session. You'll need to log in.",
				actions: [{ label: "Continue to Login", action: onRetry }],
			}
		}

		// sync errors
		if (failedStep?.step === "sync") {
			return {
				title: "Sync Engine Failed",
				message: "Background sync couldn't start. You can still use the app offline.",
				actions: [{ label: "Continue Anyway", action: onRetry }],
			}
		}

		// generic error
		return {
			title: "Initialization Failed",
			message: "Something went wrong during startup.",
			actions: [
				{ label: "Retry", action: onRetry },
				{ label: "Report Problem", action: () => reportProblem(error, results) },
			],
		}
	}

	const openStorageSettings = () => {
		Alert.alert(
			"Free Up Storage",
			"Please delete some files, photos, or apps to free up storage space, then retry.",
			[{ text: "OK" }]
		)
	}

	const confirmDatabaseReset = () => {
		Alert.alert(
			"Reset Database?",
			"This will clear all local data. Your synced inspections are safe on the server. Continue?",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Reset",
					style: "destructive",
					onPress: async () => {
						// TODO: Implement database reset
						// 1. Delete database files
						// 2. Reinitialize database
						// 3. Re-run boot sequence
						onRetry()
					},
				},
			]
		)
	}

	const reportProblem = (error: Error | null, results: BootStepResult[]) => {
		const errorReport = {
			error: error?.message,
			stack: error?.stack,
			failedStep: failedStep?.step,
			allResults: results.map((r) => ({
				step: r.step,
				success: r.success,
				error: r.error?.message,
				duration: r.duration,
			})),
		}

		console.log("📧 Error Report:", JSON.stringify(errorReport, null, 2))

		Alert.alert(
			"Problem Reported",
			"Error details have been logged. Please contact support if the problem persists.",
			[{ text: "OK" }]
		)
	}

	const guidance = getErrorGuidance()

	return (
		<View className="flex-1 p-6 bg-background justify-center items-center">
			<Text className="text-6xl mb-4">⚠️</Text>
			<Text className="text-2xl text-[#1a1a1a] mb-2 font-bold text-center">{guidance.title}</Text>
			<Text className="text-base text-[#666] mb-6 text-center">{guidance.message}</Text>

			{/* Technical details */}
			{failedStep && (
				<View className="bg-white p-4 rounded-lg border border-[#ff3b30] mb-4 w-full">
					<Text className="text-sm text-[#ff3b30] font-semibold mb-1">
						Failed Step: {failedStep.step}
					</Text>
					<Text className="text-sm text-[#666]">
						{failedStep.error?.message || "Unknown error"}
					</Text>
				</View>
			)}

			{/* All steps status */}
			<ScrollView className="w-full max-h-48 mb-6">
				{results.map((result) => (
					<View key={result.step} className="flex-row justify-between p-3 bg-white rounded-lg mb-2">
						<Text className="text-sm text-[#1a1a1a] font-medium">
							{result.success ? "✅" : "❌"} {result.step}
						</Text>
						<Text className="text-xs text-[#999]">{result.duration}ms</Text>
					</View>
				))}
			</ScrollView>

			{/* Action buttons */}
			{guidance.actions.map((action, index) => (
				<TouchableOpacity
					key={index}
					className={`w-full px-8 py-3 rounded-lg mb-3 ${
						index === 0 ? "bg-[#007AFF]" : "bg-white border border-[#007AFF]"
					}`}
					onPress={action.action}
				>
					<Text
						className={`text-base text-center font-semibold ${
							index === 0 ? "text-white" : "text-[#007AFF]"
						}`}
					>
						{action.label}
					</Text>
				</TouchableOpacity>
			))}

			<Text className="text-xs text-[#999] text-center mt-4">
				If this problem persists, try reinstalling the app or contact support.
			</Text>
		</View>
	)
}
