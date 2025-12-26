import { Text, View, StatusBar, ActivityIndicator } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"
import RootNavigator from "./src/navigation/RootNavigator"
import { useAuth } from "./src/hooks/useAuth"
import "./global.css"
import { AuthProvider } from "./src/context/AuthContext"

function AppShell() {
	const { isReady } = useAuth()

	if (!isReady) {
		return (
			<View className="flex-1 justify-center items-center bg-background">
				<ActivityIndicator size="large" color="#007AFF" />
				<Text className="mt-3 text-base text-[#666] font-bold">Loading...</Text>
			</View>
		)
	}

	return (
		<SafeAreaProvider>
			<StatusBar barStyle="dark-content" />
			<RootNavigator />
		</SafeAreaProvider>
	)
}

export default function App() {
	return (
		<AuthProvider>
			<AppShell />
		</AuthProvider>
	)
}
