import React from "react"
import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import AuthNavigator from "./AuthNavigator"
import MainNavigator from "./MainNavigator"
import { RootStackParamList } from "./types"
import { useAuth } from "../hooks/useAuth"
import { AuthProvider } from "../context/AuthContext"

const Stack = createNativeStackNavigator<RootStackParamList>()

export default function RootNavigator() {
	const { isAuthenticated } = useAuth()

	return (
		<NavigationContainer>
			<Stack.Navigator screenOptions={{ headerShown: false }}>
				{isAuthenticated ? (
					<Stack.Screen name="Main" component={MainNavigator} />
				) : (
					<Stack.Screen name="Auth" component={AuthNavigator} />
				)}
			</Stack.Navigator>
		</NavigationContainer>
	)
}
