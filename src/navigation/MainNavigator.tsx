// Main flow navigation stack (after authentication: home, create inspection, etc.)
import React from "react"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import HomeScreen from "../screens/home/HomeScreen"
import { MainStackParamList } from "./types"
import CreateInspectionScreen from "../screens/inspection/CreateInspectionScreen"
import ConflictResolutionScreen from "../screens/conflict/ConflictResolutionScreen"
import InspectionDetailScreen from "../screens/inspection/InspectionDetailScreen"
import ProfileScreen from "../screens/profile/ProfileScreen"
import FailedInspectionScreen from "../screens/inspection/FailedInspectionScreen"

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
			<Stack.Screen name="Profile" component={ProfileScreen} />

			<Stack.Screen name="FailedInspection" component={FailedInspectionScreen} />
			<Stack.Screen name="ConflictResolution" component={ConflictResolutionScreen} />
			<Stack.Screen
				name="InspectionDetail"
				component={InspectionDetailScreen}
				options={{
					headerShown: false,
					presentation: "card",
				}}
			/>
		</Stack.Navigator>
	)
}
