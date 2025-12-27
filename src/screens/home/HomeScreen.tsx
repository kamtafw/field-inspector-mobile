import { useState } from "react"
import { View, Text, TouchableOpacity, ActivityIndicator, Button, TextInput } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import clsx from "clsx"
import { useAuth } from "@/src/hooks/useAuth"
import InspectionList from "./components/InspectionList"
import database from "@/src/database"
import Inspection from "@/src/database/models/Inspection"

export default function HomeScreen() {
	const [isLoading, setIsLoading] = useState(false)
	const [facilityName, setFacilityName] = useState("")
	const { logout } = useAuth()

	const handleLogout = async () => {
		setIsLoading(true)
		try {
			await logout()
		} catch (err: any) {
			console.error("Logout failed:", err)
		} finally {
			setIsLoading(false)
		}
	}

	const handleAddInspection = async () => {
		const inspectionsCollection = database.get<Inspection>("inspections")

		await database.write(async () => {
			await inspectionsCollection.create((inspection) => {
				inspection.facilityName = facilityName
				inspection.status = "draft"
				inspection.isSynced = false
			})
		})

		setFacilityName("")
	}

	const handleUpdateInspection = async () => {
		const inspectionsCollection = database.get<Inspection>("inspections")
		console.log("update start")

		const inspections = await inspectionsCollection.query().fetch()
		const inspection = inspections.at(-1)

		if (!inspection) {
			console.log("No inspection found")
			return
		}

		database.write(async () => {
			await inspection.update((updatedInspection) => {
				updatedInspection.facilityName = facilityName
				updatedInspection.status = "conflict"
			})
		})

		setFacilityName("")
	}

	return (
		<SafeAreaView className="flex-1 bg-background">
			<View className="bg-white p-5 pt-14 border-b border-[#e0e0e0]">
				<Text className="text-3xl text-[#1a1a1a] font-bold">Inspections</Text>
				<Text className="text-sm text-[#666] mt-1">List of inspections available.</Text>
			</View>

			{/* Content Area */}
			<View className="flex-1 px-6 py-10 justify-between">
				<View className="gap-3">
					<InspectionList />

					<View className="p-2 bg-white">
						<TextInput
							value={facilityName}
							onChangeText={setFacilityName}
							placeholder="Facility name"
							placeholderTextColor="#666"
						/>
					</View>

					<Button title="Add inspection" onPress={handleAddInspection} />
					<Button color="green" title="Update last inspection" onPress={handleUpdateInspection} />
				</View>

				{/* Logout Button */}
				<TouchableOpacity
					className={clsx("bg-[#c42] p-4 rounded-lg items-center mt-2", isLoading && "opacity-60")}
					onPress={handleLogout}
					disabled={isLoading}
				>
					{isLoading ? (
						<ActivityIndicator color="#fff" />
					) : (
						<Text className="text-white text-base font-semibold">Log Out</Text>
					)}
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	)
}
