import React from "react"
import { StatusBar } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { BootProvider } from "./src/providers/BootProvider"
import { AuthProvider } from "./src/providers/AuthProvider"
import RootNavigator from "./src/navigation/RootNavigator"
import "./global.css"

/*
TODO: defensive DB initialization - on app start:
- handle DB init failure explicitly
- log error
- fail loudly (don't silently continue)
** offline apps die from silent DB failure
*/

export default function App() {
	return (
		<BootProvider>
			<AuthProvider>
				<SafeAreaProvider>
					<StatusBar barStyle="dark-content" />
					<RootNavigator />
				</SafeAreaProvider>
			</AuthProvider>
		</BootProvider>
	)
}
