// Main flow navigation stack (after authentication: home, create inspection, etc.)
import React from "react"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import HomeScreen from "../screens/home/HomeScreen"
import { MainStackParamList } from "./types"

const Stack = createNativeStackNavigator<MainStackParamList>()

export default function MainNavigator() {
	return (
		<Stack.Navigator screenOptions={{ headerShown: false }}>
			<Stack.Screen name="Home" component={HomeScreen} />
		</Stack.Navigator>
	)
}
