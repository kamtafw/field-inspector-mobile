import useInspections from "@/src/hooks/useInspections"
import TemplateValidation from "@/src/services/template/TemplateValidation"
import { useNavigation } from "@react-navigation/native"
import clsx from "clsx"
import { useState } from "react"
import {
	ActivityIndicator,
	Alert,
	ScrollView,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

const MOCK_TEMPLATE = {
	id: "01065cfdc4f845dea92d231acd25f822",
	name: "Fire Safety Inspection",
	checklist_items: [
		{ id: "item_1", question: "Are fire extinguishers present and accessible?", type: "boolean" },
		{ id: "item_2", question: "Are emergency exits clearly marked?", type: "boolean" },
		{ id: "item_3", question: "Is the fire alarm system functional?", type: "boolean" },
		{ id: "item_4", question: "Additional notes", type: "text" },
	],
}

/*
TODO: Validate templateId existence
- templateId must exist and be non-empty
- if template not found -> block creation
** this avoids "orphan inspections"
*/

export default function CreateInspectionScreen() {
	const navigation = useNavigation()
	const { createInspection, submitInspection, isCreating } = useInspections()

	const [isLoading, setIsLoading] = useState(false)

	const [facilityName, setFacilityName] = useState("")
	const [facilityAddress, setFacilityAddress] = useState("")
	const [responses, setResponses] = useState<Record<string, any>>({})

	const handleResponseChange = (itemId: string, value: any) => {
		setResponses((prev) => ({
			...prev,
			[itemId]: {
				value,
				notes: "",
				timestamp: Date.now(),
			},
		}))
	}

	const handleSaveDraft = async () => {
		if (!facilityName.trim()) {
			Alert.alert("Error", "Please enter a facility name")
			return
		}

		setIsLoading(true)

		try {
			const data = {
				templateId: MOCK_TEMPLATE.id,
				facilityName,
				facilityAddress,
				responses,
			}

			const { isDeleted } = await TemplateValidation.validateTemplate(data.templateId)

			if (isDeleted) {
				Alert.alert(
					"Template Unavailable",
					"This inspection template is no longer available. Please contact support.",
					[{ text: "OK", onPress: () => navigation.goBack() }],
				)
				return
			}

			await createInspection(data)

			Alert.alert("Success", "Draft saved locally", [
				{ text: "OK", onPress: () => navigation.goBack() },
			])
		} catch (err: any) {
			Alert.alert("Error", err.message)
		} finally {
			setIsLoading(false)
		}
	}

	const handleSubmit = async () => {
		if (!facilityName.trim()) {
			Alert.alert("Error", "Please enter a facility name")
			return
		}

		// check if all required questions are answered
		const unansweredCount = MOCK_TEMPLATE.checklist_items
			.filter((item) => item.type === "boolean")
			.filter((item) => responses[item.id] === undefined).length

		if (unansweredCount > 0) {
			Alert.alert(
				"Incomplete",
				`You have ${unansweredCount} unanswered question(s). Save as draft?`,
				[
					{ text: "Cancel", style: "cancel" },
					{ text: "Save Draft", onPress: handleSaveDraft },
				],
			)
			return
		}

		try {
			const data = {
				templateId: MOCK_TEMPLATE.id,
				facilityName,
				facilityAddress,
				responses,
			}

			const { isDeleted } = await TemplateValidation.validateTemplate(data.templateId)

			if (isDeleted) {
				Alert.alert(
					"Template Unavailable",
					"This inspection template is no longer available. Please contact support.",
					[{ text: "OK", onPress: () => navigation.goBack() }],
				)
				return
			}

			const inspection = await createInspection(data)
			await submitInspection(inspection.id)

			Alert.alert("Success", "Inspection created!", [
				{
					text: "OK",
					onPress: async () => {
						navigation.goBack()
					},
				},
			])
		} catch (err: any) {
			Alert.alert("Error", err.message)
		}
	}

	return (
		<SafeAreaView className="flex-1 bg-background">
			{/* Header */}
			<View className="flex-row justify-between items-center p-4 pt-14 bg-white border-b border-[#e0e0e0]">
				<TouchableOpacity onPress={() => navigation.goBack()}>
					<Text className="text-base text-[#007AFF]">Cancel</Text>
				</TouchableOpacity>
				<Text className="text-lg text-[#1a1a1a] font-semibold">New Inspection</Text>
				<TouchableOpacity onPress={handleSaveDraft} disabled={isLoading}>
					<Text className={clsx("text-base text-[#007AFF]", isLoading && "opacity-50")}>Draft</Text>
				</TouchableOpacity>
			</View>

			<ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
				{/* Basic Info */}
				<View className="bg-white rounded-xl p-4 mb-4">
					<Text className="text-lg text-[#1a1a1a] font-semibold mb-4">Facility Information</Text>
					<View className="mb-4">
						<Text className="text-sm text-[#333] font-medium mb-2">
							Facility Name<Text className="text-[#f00]">*</Text>
						</Text>
						<TextInput
							className="bg-[#f9f9f9] border border-[#e0e0e0] rounded-lg p-3 text-base text-[#1a1a1a]"
							placeholder="e.g., ABC Restaurant"
							placeholderTextColor="#999"
							value={facilityName}
							onChangeText={setFacilityName}
						/>
					</View>
					<View>
						<Text className="text-sm text-[#333] font-medium mb-2">
							Facility Address<Text className="text-[#f00]">*</Text>
						</Text>
						<TextInput
							className="bg-[#f9f9f9] border border-[#e0e0e0] rounded-lg p-3 text-base text-[#1a1a1a]"
							placeholder="e.g., 123 Main St, City, State"
							placeholderTextColor="#999"
							value={facilityAddress}
							onChangeText={setFacilityAddress}
						/>
					</View>
				</View>
				{/* Checklist */}
				<View className="bg-white rounded-xl p-4 mb-4">
					<Text className="text-lg text-[#1a1a1a] font-semibold mb-4">{MOCK_TEMPLATE.name}</Text>

					{MOCK_TEMPLATE.checklist_items.map((item) => (
						<View key={item.id} className="mb-6">
							<Text className="text-base text-[#1a1a1a] mb-3">{item.question}</Text>

							{item.type === "boolean" ? (
								<View className="flex-row gap-3">
									<TouchableOpacity
										className={clsx(
											"flex-1 bg-gray-50 border-2 border-[#e0e0e0] rounded-lg p-3 items-center",
											responses[item.id]?.value === "pass" && "bg-green-100 border-green-600",
										)}
										onPress={() => handleResponseChange(item.id, "pass")}
									>
										<Text
											className={clsx(
												"text-base text-[#666] font-semibold",
												responses[item.id]?.value === "pass" && "text-[#1a1a1a]",
											)}
										>
											✓ Pass
										</Text>
									</TouchableOpacity>
									<TouchableOpacity
										className={clsx(
											"flex-1 bg-gray-50 border-2 border-[#e0e0e0] rounded-lg p-3 items-center",
											responses[item.id]?.value === "fail" && "bg-red-100 border-red-400",
										)}
										onPress={() => handleResponseChange(item.id, "fail")}
									>
										<Text
											className={clsx(
												"text-base text-[#666] font-semibold",
												responses[item.id]?.value === "pass" && "text-[#1a1a1a]",
											)}
										>
											✕ Fail
										</Text>
									</TouchableOpacity>
								</View>
							) : (
								<TextInput
									className="bg-[#f9f9f9] border border-[#e0e0e0] rounded-lg p-3 text-base text-[#1a1a1a] min-h-24"
									placeholder="Enter notes..."
									placeholderTextColor="#999"
									value={responses[item.id]?.value || ""}
									onChangeText={(text) => handleResponseChange(item.id, text)}
									multiline
									numberOfLines={4}
									textAlignVertical="top"
								/>
							)}
						</View>
					))}
				</View>
			</ScrollView>

			{/* Submit Button */}
			<View className="p-4 bg-white border-t border-[#e0e0e0]">
				<TouchableOpacity
					onPress={handleSubmit}
					className={clsx("bg-[#007AFF] p-4 rounded-lg items-center", isCreating && "opacity-50")}
					disabled={isCreating}
				>
					{isCreating ? (
						<ActivityIndicator color="#fff" />
					) : (
						<Text className="text-white text-base font-semibold">Submit Inspection</Text>
					)}
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	)
}
