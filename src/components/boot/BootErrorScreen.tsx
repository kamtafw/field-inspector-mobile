import { BootStepResult } from "@/src/services/boot/BootManager"
import { ScrollView, Text, TouchableOpacity, View } from "react-native"

interface BootErrorScreenProps {
	error: Error | null
	results: BootStepResult[]
	onRetry: () => void
}

export default function BootErrorScreen({ error, results, onRetry }: BootErrorScreenProps) {
	const failedStep = results.find((r) => !r.success)

	return (
		<View className="flex-1 p-6 bg-background justify-center items-center">
			<Text className="text-6xl mb-4">⚠️</Text>
			<Text className="text-2xl text-[#1a1a1a] mb-4">Initialization failed</Text>

			{failedStep && (
				<View className="bg-background p-4 rounded-lg border border-[#ff3b30] mb-4 w-full">
					<Text className="text-sm text-[#ff3b30] font-semibold mb-1">Step: {failedStep.step}</Text>
					<Text className="text-sm text-[#666]">
						{failedStep.error?.message || "Unknown error"}
					</Text>
				</View>
			)}

			{/* Show all steps status */}
			<ScrollView className="w-full max-h-48 mb-4">
				{results.map((result) => (
					<View key={result.step} className="flex-row justify-between p-3 bg-white rounded-lg mb-2">
						<Text className="text-sm text-[#1a1a1a] font-medium">
							{result.success ? "✅" : "❌"} {result.step}
						</Text>
						<Text className="text-xs text-[#999]">{result.duration}ms</Text>
					</View>
				))}
			</ScrollView>

			<TouchableOpacity className="bg-[#007AFF] px-8 py-3 rounded-lg mb-4">
				<Text className="text-base text-white font-semibold">Retry</Text>
			</TouchableOpacity>

			<Text className="text-xs text-[#999] text-center">
				If this problem persists, try reinstalling the app.
			</Text>
		</View>
	)
}
