import { useEffect } from "react"
import { StyleSheet, Text, View, StatusBar } from "react-native"
import { subscribeToNetworkChanges } from "./src/services/network/NetworkMonitor"
import { SafeAreaProvider } from "react-native-safe-area-context"
import "./global.css"
import LoginScreen from "./src/screens/auth/LoginScreen"

export default function App() {
	useEffect(() => {
		const unsubscribe = subscribeToNetworkChanges((state) => {
			console.log("NETWORK CHANGE:", {
				isConnected: state.isConnected,
				isInternetReachable: state.isInternetReachable,
				type: state.type,
			})
		})

		return unsubscribe
	}, [])
	return (
		<SafeAreaProvider>
			<StatusBar barStyle="dark-content" />
			<LoginScreen onLoginSuccess={() => {}} />
		</SafeAreaProvider>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#fff",
		alignItems: "center",
		justifyContent: "center",
	},
})
