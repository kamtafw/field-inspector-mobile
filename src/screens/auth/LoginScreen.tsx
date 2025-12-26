import { useState } from "react"
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native"
import { clsx } from "clsx"
import { useAuth } from "@/src/hooks/useAuth"

export default function LoginScreen() {
	const [email, setEmail] = useState(__DEV__ ? "admin@example.com" : "")
	const [password, setPassword] = useState(__DEV__ ? "Year-2025" : "")
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState("")
	const { login } = useAuth()

	const handleLogin = async () => {
		if (!email || !password) {
			setError("Please enter email and password")
			return
		}

		setIsLoading(true)
		setError("")

		try {
			await login({ email, password })
		} catch (err: any) {
			console.error("Login error:", err)
			const errorMessage = err.response?.data?.error || err.message || "Login failed"
			setError(errorMessage)
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<KeyboardAvoidingView
			className="flex-1 bg-background"
			behavior={Platform.OS === "ios" ? "padding" : "height"}
		>
			<View className="flex-1 justify-center p-6">
				{/* Header */}
				<View className="items-center mb-12">
					<Text className="text-3xl font-bold text-[#1a1a1a] mb-2">Field Inspector</Text>
					<Text className="text-base text-[#666]">Sign in to continue</Text>
				</View>

				{/* Form */}
				<View className="w-[100%]">
					<View className="mb-5">
						<Text className="text-sm font-semibold text-[#333] mb-2">Email</Text>
						<TextInput
							className="bg-white border border-neutral-50 rounded-lg p-4 text-base text-[#1a1a1a]"
							value={email}
							onChangeText={setEmail}
							placeholder="you@example.com"
							placeholderTextColor="#999"
							autoCapitalize="none"
							autoCorrect={false}
							keyboardType="email-address"
							editable={!isLoading}
						/>
					</View>

					<View className="mb-5">
						<Text className="text-sm font-semibold text-[#333] mb-2">Password</Text>
						<TextInput
							className="bg-white border border-neutral-50 rounded-lg p-4 text-base text-[#1a1a1a]"
							value={password}
							onChangeText={setPassword}
							placeholder="Enter Password"
							placeholderTextColor="#999"
							secureTextEntry
							editable={!isLoading}
						/>
					</View>

					{/* Error Message */}
					{error ? (
						<View className="bg-[#fee] p-3 rounded-lg mb-4">
							<Text className="text-[#c00] text-sm">⚠️ {error}</Text>
						</View>
					) : null}

					{/* Login Button */}
					<TouchableOpacity
						className={clsx(
							"bg-[#007aff] p-4 rounded-lg items-center mt-2",
							isLoading && "opacity-60"
						)}
						onPress={handleLogin}
						disabled={isLoading}
					>
						{isLoading ? (
							<ActivityIndicator color="#fff" />
						) : (
							<Text className="text-white text-base font-semibold">Sign In</Text>
						)}
					</TouchableOpacity>
				</View>

				{/* Footer */}
				<Text className="text-center text-[#999] text-xs mt-6">
					Demo credentials: admin@example.com / Year-2025
				</Text>
			</View>
		</KeyboardAvoidingView>
	)
}
