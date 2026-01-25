import { View, Text, TouchableOpacity } from "react-native"

interface EmptyStateProps {
	icon?: string
	title: string
	message: string
	actionLabel?: string
	onAction?: () => void
}

export default function EmptyState({
	icon = "📋",
	title,
	message,
	actionLabel,
	onAction,
}: EmptyStateProps) {
	return (
		<View className="flex-1 justify-center items-center p-8">
			<Text className="text-6xl mb-4">{icon}</Text>
			<Text className="text-xl font-semibold text-[#1a1a1a] text-center mb-2">{title}</Text>
			<Text className="text-base text-[#666] text-center mb-6">{message}</Text>

			{actionLabel && onAction && (
				<TouchableOpacity
					className="bg-[#007aff] px-6 py-3 rounded-lg"
					onPress={onAction}
					activeOpacity={0.8}
				>
					<Text className="text-base font-semibold text-white">{actionLabel}</Text>
				</TouchableOpacity>
			)}
		</View>
	)
}

export const NoInspectionsEmpty = ({ onCreate }: { onCreate: () => void }) => (
	<EmptyState
		icon="📋"
		title="No Inspections Yet"
		message="Create your first inspection to get started"
		actionLabel="Create Inspection"
		onAction={onCreate}
	/>
)

export const NoPhotosEmpty = ({ onAdd }: { onAdd: () => void }) => (
	<EmptyState
		icon="📸"
		title="No Photos"
		message="Add photos to document this inspection"
		actionLabel="Add Photo"
		onAction={onAdd}
	/>
)

export const NoResultsEmpty = () => (
	<EmptyState icon="🔍" title="No Results Found" message="Try adjusting your search or filters" />
)

export const NoConnectionEmpty = ({ onRetry }: { onRetry: () => void }) => (
	<EmptyState
		icon="📡"
		title="No Connection"
		message="Check your internet connection and try again"
		actionLabel="Retry"
		onAction={onRetry}
	/>
)
