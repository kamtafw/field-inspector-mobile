import { useEffect } from "react"
import { StyleSheet, Text, View, StatusBar } from "react-native"
import { subscribeToNetworkChanges } from "./src/services/network/NetworkMonitor"
import { SafeAreaProvider } from "react-native-safe-area-context"
import LoginScreen from "./src/screens/auth/LoginScreen"
import HomeScreen from "./src/screens/home/HomeScreen"
import "./global.css"
import authApi from "./src/services/api/auth.api"
import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { useBootstrapApp } from "./src/hooks/useBootstrapApp"

function Navigation() {
	// useEffect(() => {
	// 	const unsubscribe = subscribeToNetworkChanges((state) => {
	// 		console.log("NETWORK CHANGE:", {
	// 			isConnected: state.isConnected,
	// 			isInternetReachable: state.isInternetReachable,
	// 			type: state.type,
	// 		})
	// 	})

	// 	return unsubscribe
	// }, [])
	const { ready, error, user } = useBootstrapApp()

	const Stack = createNativeStackNavigator()
	console.log("IS Ready:", ready)

	return (
		<NavigationContainer>
			<Stack.Navigator screenOptions={{ headerShown: false }}>
				{ready ? (
					<Stack.Screen name="Home" component={HomeScreen} />
				) : (
					<Stack.Screen name="Login">
						{(props) => <LoginScreen {...props} onLoginSuccess={() => {}} />}
					</Stack.Screen>
				)}
			</Stack.Navigator>
		</NavigationContainer>
	)
}

export default function App() {
	return (
		<SafeAreaProvider>
			<StatusBar barStyle="dark-content" />
			<Navigation />
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
