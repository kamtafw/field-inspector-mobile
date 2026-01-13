import NetworkMonitor, { NetworkStatus } from "@/src/services/network/NetworkMonitor"
import { useEffect, useState } from "react"
import { Text, View } from "react-native"

export default function NetworkStatusIndicator() {
	const [status, setStatus] = useState<NetworkStatus>(NetworkMonitor.getStatus())

	useEffect(() => {
		const handleStatusChange = (newState: NetworkStatus) => {
			setStatus(newState)
		}

		NetworkMonitor.addListener(handleStatusChange)

		return () => {
			NetworkMonitor.removeListener(handleStatusChange)
		}
	}, [])

	if (status === "online") {
		return null
	}

	return (
		<View className="bg-[#ff9500] flex-row items-center py-2 px-4">
			<View className="w-2 h-2 rounded bg-white mr-2" />
			<Text className="text-sm text-white font-medium">
				{status === "offline" ? "offline - Changes will sync later" : "Checking connection..."}
			</Text>
		</View>
	)
}
