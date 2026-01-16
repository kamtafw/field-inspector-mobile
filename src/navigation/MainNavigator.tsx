// Main flow navigation stack (after authentication: home, create inspection, etc.)
import React from "react"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import HomeScreen from "../screens/home/HomeScreen"
import { MainStackParamList } from "./types"
import CreateInspectionScreen from "../screens/inspection/CreateInspectionScreen"
import ConflictListScreen from "../screens/conflict/ConflictListScreen"
import ConflictResolutionScreen from "../screens/conflict/ConflictResolutionScreen"

const Stack = createNativeStackNavigator<MainStackParamList>()

export default function MainNavigator() {
	return (
		<Stack.Navigator screenOptions={{ headerShown: false }}>
			<Stack.Screen name="Home" component={HomeScreen} />
			<Stack.Screen
				name="CreateInspection"
				component={CreateInspectionScreen}
				options={{ presentation: "modal" }}
			/>

			<Stack.Screen name="ConflictList" component={ConflictListScreen} />
			<Stack.Screen name="ConflictResolution" component={ConflictResolutionScreen} />
			{/* <Stack.Screen/> */}
		</Stack.Navigator>
	)
}
