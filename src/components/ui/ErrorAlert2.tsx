// src/components/ui/ErrorAlert.tsx

import React from "react"
import { View, Text, TouchableOpacity, Linking } from "react-native"
import { AlertCircle, RefreshCw, LogIn, Settings } from "lucide-react-native"
import ErrorHandler from "@/src/services/error/ErrorHandler"
import { useNavigation } from "@react-navigation/native"

interface ErrorAlertProps {
	error: any
	onRetry?: () => void
	onDismiss?: () => void
}

export function ErrorAlert({ error, onRetry, onDismiss }: ErrorAlertProps) {
	const navigation = useNavigation()
	const handled = ErrorHandler.handle(error)

	const handleAction = () => {
		switch (handled.action) {
			case "Retry":
				onRetry?.()
				break

			case "Log In":
				// Navigate to login
				navigation.navigate("Login" as never)
				break

			case "Open Settings":
				Linking.openSettings()
				break

			case "Resolve":
				// Navigate to conflict resolution
				navigation.navigate("ConflictResolution" as never)
				break

			default:
				onDismiss?.()
		}
	}

	const getIcon = () => {
		if (handled.retryable) return RefreshCw
		if (handled.action === "Log In") return LogIn
		if (handled.action === "Open Settings") return Settings
		return AlertCircle
	}

	const Icon = getIcon()

	return (
		<View className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 m-4">
			<View className="flex-row items-start mb-3">
				<Icon size={24} color="#DC2626" className="mr-3 mt-0.5" />
				<View className="flex-1">
					<Text className="text-red-900 font-semibold text-base mb-1">{handled.title}</Text>
					<Text className="text-red-700 text-sm leading-5">{handled.message}</Text>
				</View>
			</View>

			{handled.action && (
				<TouchableOpacity
					className={`rounded-lg p-3 ${handled.retryable ? "bg-red-600" : "bg-red-700"}`}
					onPress={handleAction}
				>
					<Text className="text-white text-center font-semibold">{handled.action}</Text>
				</TouchableOpacity>
			)}
		</View>
	)
}
