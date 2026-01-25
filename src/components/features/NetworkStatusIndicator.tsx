import NetworkMonitor, { NetworkStatus } from "@/src/services/network/NetworkMonitor"
import { useEffect, useRef, useState } from "react"
import { Text, View } from "react-native"
import Feather from "@expo/vector-icons/Feather"
import { Animated } from "react-native"

export default function NetworkStatusIndicator() {
	const [status, setStatus] = useState<NetworkStatus>(NetworkMonitor.getStatus())
	const slideAnim = useRef(new Animated.Value(-60)).current

	useEffect(() => {
		const handleStatusChange = (newState: NetworkStatus) => {
			setStatus(newState)
		}

		NetworkMonitor.addListener(handleStatusChange)

		return () => {
			NetworkMonitor.removeListener(handleStatusChange)
		}
	}, [])

	useEffect(() => {
		if (status === "offline") {
			Animated.spring(slideAnim, {
				toValue: 0,
				useNativeDriver: true,
				tension: 50,
				friction: 8,
			}).start()
		} else {
			Animated.timing(slideAnim, {
				toValue: -60,
				duration: 200,
				useNativeDriver: true,
			}).start()
		}
	}, [status])

	if (status === "online") {
		return null
	}

	return (
		<Animated.View
			className="bg-[#ff9500] flex-row items-center py-2 px-4"
			style={{
				transform: [{ translateY: slideAnim }],
				position: "absolute",
				top: 30,
				left: 0,
				right: 0,
				zIndex: 100,
			}}
		>
			{status === "offline" ? (
				<Feather name="wifi-off" size={18} color="white" className="mr-2" />
			) : (
				<View className="w-2 h-2 rounded bg-white mr-2" />
			)}
			<Text className="text-sm text-white font-medium">
				{status === "offline"
					? "You're offline. Changes will sync when reconnected."
					: "Checking connection..."}
			</Text>
		</Animated.View>
	)
}
