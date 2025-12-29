import { StatusBar } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"
import RootNavigator from "./src/navigation/RootNavigator"
import "./global.css"
import { BootProvider } from "./src/context/BootContext"

/*
TODO: defensive DB initialization - on app start:
- handle DB init failure explicitly
- log error
- fail loudly (don't silently continue)
** offline apps die from silent DB failure
*/

function AppContent() {
	return (
		<SafeAreaProvider>
			<StatusBar barStyle="dark-content" />
			<RootNavigator />
		</SafeAreaProvider>
	)
}

export default function App() {
	return (
		<BootProvider>
			<AppContent />
		</BootProvider>
	)
}
