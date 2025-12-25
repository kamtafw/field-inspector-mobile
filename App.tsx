import { StatusBar } from "expo-status-bar"
import { useEffect } from "react"
import { StyleSheet, Text, View } from "react-native"
import { getNetworkState, subscribeToNetworkChanges } from "./src/services/network/NetworkMonitor"

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
		<View style={styles.container}>
			<Text>NETWORK DETECTION ACTIVE!</Text>
			<Text>Listening for network changes...</Text>
			<StatusBar style="auto" />
		</View>
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
