import React, { Component, ErrorInfo, ReactNode } from "react"
import { View, Text, TouchableOpacity, ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

interface Props {
	children: ReactNode
	fallback?: (error: Error, resetError: () => void) => ReactNode
}

interface State {
	hasError: boolean
	error: Error | null
	errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props)
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
		}
	}

	static getDerivedStateFromError(error: Error): State {
		return {
			hasError: true,
			error,
			errorInfo: null,
		}
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		console.error("🔥 ErrorBoundary caught error:", error)
		console.error("Component stack:", errorInfo.componentStack)

		this.setState({
			error,
			errorInfo,
		})

		// TODO: Send to error tracking service (Sentry, Bugsnag, etc.)
		this.logErrorToService(error, errorInfo)
	}

	private logErrorToService(error: Error, errorInfo: ErrorInfo) {
		// Example: Send to your error tracking service
		const errorReport = {
			message: error.message,
			stack: error.stack,
			componentStack: errorInfo.componentStack,
			timestamp: new Date().toISOString(),
			userAgent: navigator.userAgent,
		}

		console.log("📧 Error report:", JSON.stringify(errorReport, null, 2))

		// in production, send to Sentry/Bugsnag:
		// Sentry.captureException(error, { contexts: { react: errorInfo } })
	}

	private resetError = () => {
		this.setState({
			hasError: false,
			error: null,
			errorInfo: null,
		})
	}

	render() {
		if (this.state.hasError) {
			// use custom fallback if provided
			if (this.props.fallback) {
				return this.props.fallback(this.state.error!, this.resetError)
			}

			// default error UI
			return (
				<SafeAreaView className="flex-1 bg-background">
					<View className="flex-1 p-6 justify-center items-center">
						<Text className="text-6xl mb-4">💥</Text>
						<Text className="text-2xl text-[#1a1a1a] font-bold mb-2 text-center">
							Something Went Wrong
						</Text>
						<Text className="text-base text-[#666] mb-6 text-center">
							The app encountered an unexpected error. Don't worry, your data is safe.
						</Text>

						{/* Error details (collapsible in production) */}
						{__DEV__ && this.state.error && (
							<ScrollView className="w-full max-h-64 mb-6 bg-white rounded-lg p-4 border border-[#ff3b30]">
								<Text className="text-xs text-[#ff3b30] font-semibold mb-2">
									Error Details (Dev Only):
								</Text>
								<Text className="text-xs text-[#666] mb-2">{this.state.error.message}</Text>
								{this.state.error.stack && (
									<Text className="text-xs text-[#999] font-mono">{this.state.error.stack}</Text>
								)}
							</ScrollView>
						)}

						{/* Actions */}
						<TouchableOpacity
							className="bg-[#007AFF] px-8 py-3 rounded-lg mb-3 w-full"
							onPress={this.resetError}
						>
							<Text className="text-base text-white font-semibold text-center">Try Again</Text>
						</TouchableOpacity>

						<TouchableOpacity
							className="bg-white border border-[#007AFF] px-8 py-3 rounded-lg w-full"
							onPress={() => {
								// TODO: Navigate to home or restart app
								this.resetError()
							}}
						>
							<Text className="text-base text-[#007AFF] font-semibold text-center">Go to Home</Text>
						</TouchableOpacity>

						<Text className="text-xs text-[#999] text-center mt-6">
							If this keeps happening, please restart the app or contact support.
						</Text>
					</View>
				</SafeAreaView>
			)
		}

		return this.props.children
	}
}
