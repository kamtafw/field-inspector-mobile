import { BootStep } from "@/src/services/boot/BootManager"
import { ActivityIndicator, Text, View } from "react-native"

interface BootLoadingScreenProps {
	currentStep: BootStep | null
}

export default function BootLoadingScreen({ currentStep }: BootLoadingScreenProps) {
	const stepLabels: Record<BootStep, string> = {
		database: "Setting up database...",
		auth: "Restoring session...",
		network: "Checking connection...",
		sync: "Preparing sync...",
		notifications: "Setting up notifications...",
		analytics: "Initializing analytics...",
	}

	return (
		<View className="flex-1 justify-center items-center bg-background">
			<ActivityIndicator size="large" color="#007AFF" />
			<Text className="mt-4 text-xl text-[#1a1a1a] font-semibold">Starting Field Inspector</Text>
			{currentStep && <Text className="mt-2 text-sm text-[#666]">{stepLabels[currentStep]}</Text>}
		</View>
	)
}
