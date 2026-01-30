import React, { useEffect, useRef, useState } from "react"
import { View, Text, Animated, TouchableOpacity, Platform } from "react-native"
import UnifiedErrorHandler, { ErrorInfo } from "@/src/services/error/UnifiedErrorHandler"

export default function GlobalErrorToast() {
	const [error, setError] = useState<ErrorInfo | null>(null)
	const slideAnim = useRef(new Animated.Value(-100)).current
	const [isVisible, setIsVisible] = useState(false)

	useEffect(() => {
		const unsubscribe = UnifiedErrorHandler.onToast((errorInfo) => {
			setError(errorInfo)
			setIsVisible(true)
		})

		return unsubscribe
	}, [])

	useEffect(() => {
		if (isVisible) {
			Animated.spring(slideAnim, {
				toValue: 0,
				useNativeDriver: true,
				tension: 50,
				friction: 8,
			}).start()

			const timer = setTimeout(() => {
				handleDismiss()
			}, 4000)

			return () => clearTimeout(timer)
		} else {
			Animated.timing(slideAnim, {
				toValue: -100,
				duration: 200,
				useNativeDriver: true,
			}).start()
		}
	}, [isVisible])

	const handleDismiss = () => {
		Animated.timing(slideAnim, {
			toValue: -100,
			duration: 200,
			useNativeDriver: true,
		}).start(() => {
			setIsVisible(false)
			setError(null)
		})
	}

	if (!error || !isVisible) return null

	const getBgColor = () => {
		switch (error.severity) {
			case "error":
				return "bg-[#ff3b30]"
			case "warning":
				return "bg-[#ff9500]"
			case "info":
				return "bg-[#007aff]"
		}
	}

	return (
		<Animated.View
			className="absolute left-0 right-0 z-50"
			style={{
				transform: [{ translateY: slideAnim }],
				top: Platform.OS === "ios" ? 50 : 10,
			}}
		>
			<View className={`mx-4 rounded-lg p-4 shadow-lg ${getBgColor()}`}>
				<View className="flex-row items-start justify-between">
					<View className="flex-1 mr-2">
						<Text className="text-white font-semibold text-base mb-1">{error.title}</Text>
						<Text className="text-white text-sm opacity-90">{error.message}</Text>
					</View>

					<TouchableOpacity onPress={handleDismiss} className="p-1">
						<Text className="text-white text-xl font-bold">×</Text>
					</TouchableOpacity>
				</View>
			</View>
		</Animated.View>
	)
}
