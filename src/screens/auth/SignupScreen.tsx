import React, { useState } from "react"
import { useNavigation } from "@react-navigation/native"
import { SafeAreaView } from "react-native-safe-area-context"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native"
import AuthAPI from "@/src/services/api/auth.api"
import { useAuth } from "@/src/providers/AuthProvider"
import { AuthStackParamList } from "@/src/navigation/types"

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, "Signup">

export default function SignupScreen() {
	const navigation = useNavigation<NavigationProp>()
	const { signup } = useAuth()

	const [firstName, setFirstName] = useState("")
	const [lastName, setLastName] = useState("")
	const [password, setPassword] = useState("")
	const [confirmPassword, setConfirmPassword] = useState("")
	const [generatedEmail, setGeneratedEmail] = useState("")

	const [isLoading, setIsLoading] = useState(false)
	const [errors, setErrors] = useState<Record<string, string>>({})

	const previewEmail = () => {
		if (!firstName.trim() || !lastName.trim()) {
			setGeneratedEmail("")
			return
		}

		const first = firstName
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]/g, "")
		const last = lastName
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]/g, "")

		if (first && last) {
			setGeneratedEmail(`${first}.${last}@vantage.com`)
		} else {
			setGeneratedEmail("")
		}
	}

	useState(() => previewEmail())

	const validate = (): boolean => {
		const newErrors: Record<string, string> = {}

		if (!firstName.trim()) {
			newErrors.firstName = "First name is required"
		}

		if (!lastName.trim()) {
			newErrors.lastName = "Last name is required"
		}

		if (!password) {
			newErrors.password = "Password is required"
		} else if (password.length < 8) {
			newErrors.password = "Password must be at least 8 characters"
		}

		if (password !== confirmPassword) {
			newErrors.confirmPassword = "Passwords don't match"
		}

		setErrors(newErrors)
		return Object.keys(newErrors).length === 0
	}

	const handleSignup = async () => {
		if (!validate()) return

		setIsLoading(true)
		setErrors({})

		try {
			await signup({
				firstName: firstName.trim(),
				lastName: lastName.trim(),
				password,
			})
		} catch (err: any) {
			console.error("Signup error:", err)

			if (err.response?.data?.errors) {
				setErrors(err.response.data.errors)
				// UnifiedErrorHandler.showToast(err)
			} else {
				// UnifiedErrorHandler.showAlert(err)
			}
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<SafeAreaView className="flex-1 bg-background">
			<KeyboardAvoidingView
				className="flex-1"
				behavior={Platform.OS === "ios" ? "padding" : "height"}
			>
				<ScrollView
					className="flex-1"
					contentContainerClassName="p-6"
					keyboardShouldPersistTaps="handled"
				>
					{/* Header */}
					<View className="items-center my-8">
						<Text className="text-3xl text-[#1a1a1a] font-bold mb-2">Create Account</Text>
						<Text className="text-base text-[#666]">Sign up to get started</Text>
					</View>

					{/* Form */}
					<View className="w-full">
						{/* First Name */}
						<View className="mb-4">
							<Text className="text-sm font-semibold text-[#333] mb-2">First Name</Text>
							<TextInput
								className="bg-white border border-neutral-50 p-4 rounded-lg text-base text-[#1a1a1a]"
								value={firstName}
								onChangeText={(text) => {
									setFirstName(text)
									if (errors.firstName) {
										setErrors({ ...errors, firstName: "" })
									}
									setTimeout(previewEmail, 100)
								}}
								placeholder="John"
								placeholderTextColor="#999"
								autoCapitalize="words"
								editable={!isLoading}
							/>
							{errors.firstName && (
								<Text className="text-xs text-[#ff3b30] mt-1">{errors.firstName}</Text>
							)}
						</View>

						{/* Last Name */}
						<View className="mb-4">
							<Text className="text-sm font-semibold text-[#333] mb-2">Last Name</Text>
							<TextInput
								className="bg-white border border-neutral-50 p-4 rounded-lg text-base text-[#1a1a1a]"
								value={lastName}
								onChangeText={(text) => {
									setLastName(text)
									if (errors.lastName) {
										setErrors({ ...errors, lastName: "" })
									}
									setTimeout(previewEmail, 100)
								}}
								placeholder="Doe"
								placeholderTextColor="#999"
								autoCapitalize="words"
								editable={!isLoading}
							/>
							{errors.lastName && (
								<Text className="text-xs text-[#ff3b30] mt-1">{errors.lastName}</Text>
							)}
						</View>

						{/* Email */}
						{generatedEmail && (
							<View className="mb-4 bg-[#e3f2fd] p-3 rounded-lg">
								<Text className="text-xs font-semibold text-[#0277bd] mb-1">
									Your email will be:
								</Text>
								<Text className="text-base text-[#0277bd] font-bold">{generatedEmail}</Text>
							</View>
						)}

						{/* Password */}
						<View className="mb-4">
							<Text className="text-sm font-semibold text-[#333] mb-2">Password</Text>
							<TextInput
								className="bg-white border border-neutral-50 p-4 rounded-lg text-base text-[#1a1a1a]"
								value={password}
								onChangeText={(text) => {
									setPassword(text)
									if (errors.password) {
										setErrors({ ...errors, password: "" })
									}
								}}
								placeholder="At least 8 characters"
								placeholderTextColor="#999"
								secureTextEntry
								editable={!isLoading}
							/>
							{errors.password && (
								<Text className="text-xs text-[#ff3b30] mt-1">{errors.password}</Text>
							)}
						</View>

						{/* Confirm Password */}
						<View className="mb-6">
							<Text className="text-sm font-semibold text-[#333] mb-2">Confirm Password</Text>
							<TextInput
								className="bg-white border border-neutral-50 p-4 rounded-lg text-base text-[#1a1a1a]"
								value={confirmPassword}
								onChangeText={(text) => {
									setConfirmPassword(text)
									if (errors.confirmPassword) {
										setErrors({ ...errors, confirmPassword: "" })
									}
								}}
								placeholder="Re-enter password"
								placeholderTextColor="#999"
								secureTextEntry
								editable={!isLoading}
							/>
							{errors.confirmPassword && (
								<Text className="text-xs text-[#ff3b30] mt-1">{errors.confirmPassword}</Text>
							)}
						</View>

						{/* Signup Button */}
						<TouchableOpacity
							className={`bg-[#007aff] p-4 rounded-lg items-center mb-4 ${isLoading && "opacity-60"}`}
							onPress={handleSignup}
							disabled={isLoading}
						>
							{isLoading ? (
								<ActivityIndicator color="#fff" />
							) : (
								<Text className="text-white text-base font-semibold">Create Account</Text>
							)}
						</TouchableOpacity>

						{/* Login Link */}
						<View className="flex-row justify-center items-center">
							<Text className="text-[#666] text-sm">Already have an account? </Text>
							<TouchableOpacity onPress={() => navigation.navigate("Login")} disabled={isLoading}>
								<Text className="text-[#007aff] text-sm font-semibold">Log In</Text>
							</TouchableOpacity>
						</View>
					</View>
				</ScrollView>
			</KeyboardAvoidingView>
		</SafeAreaView>
	)
}
