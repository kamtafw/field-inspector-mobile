// src/components/ui/ErrorToast.tsx

import React, { useEffect } from "react"
import { View, Text, Animated, TouchableOpacity } from "react-native"
import { X } from "lucide-react-native"
import ErrorHandler from "@/src/services/error/ErrorHandler"

interface ErrorToastProps {
	error: any
	visible: boolean
	onDismiss: () => void
	autoHideDuration?: number
}

export function ErrorToast({
	error,
	visible,
	onDismiss,
	autoHideDuration = 5000,
}: ErrorToastProps) {
	const slideAnim = new Animated.Value(-100)

	useEffect(() => {
		if (visible) {
			// Slide in
			Animated.spring(slideAnim, {
				toValue: 0,
				useNativeDriver: true,
				tension: 50,
				friction: 8,
			}).start()

			// Auto hide
			if (autoHideDuration > 0) {
				const timer = setTimeout(onDismiss, autoHideDuration)
				return () => clearTimeout(timer)
			}
		} else {
			// Slide out
			Animated.timing(slideAnim, {
				toValue: -100,
				duration: 200,
				useNativeDriver: true,
			}).start()
		}
	}, [visible])

	if (!visible) return null

	const handled = ErrorHandler.handle(error)

	return (
		<Animated.View
			className="absolute top-0 left-0 right-0 z-50"
			style={{
				transform: [{ translateY: slideAnim }],
			}}
		>
			<View className="bg-red-600 mx-4 mt-12 rounded-lg p-4 shadow-lg">
				<View className="flex-row items-start justify-between">
					<View className="flex-1 mr-2">
						<Text className="text-white font-semibold mb-1">{handled.title}</Text>
						<Text className="text-red-100 text-sm">{handled.message}</Text>
					</View>

					<TouchableOpacity onPress={onDismiss} className="p-1">
						<X size={20} color="white" />
					</TouchableOpacity>
				</View>
			</View>
		</Animated.View>
	)
}
