import { useEffect, useRef } from "react"
import { View, Animated, Easing } from "react-native"

interface SkeletonProps {
	width?: number | string
	height?: number
	borderRadius?: number
	style?: any
}

export function Skeleton({ width = "100%", height = 16, borderRadius = 4, style }: SkeletonProps) {
	const animatedValue = useRef(new Animated.Value(0)).current

	useEffect(() => {
		Animated.loop(
			Animated.sequence([
				Animated.timing(animatedValue, {
					toValue: 1,
					duration: 1000,
					easing: Easing.ease,
					useNativeDriver: true,
				}),
				Animated.timing(animatedValue, {
					toValue: 0,
					duration: 1000,
					easing: Easing.ease,
					useNativeDriver: true,
				}),
			])
		).start()
	}, [])

	const opacity = animatedValue.interpolate({
		inputRange: [0, 1],
		outputRange: [0.3, 0.7],
	})

	return (
		<Animated.View
			style={[
				{
					width,
					height,
					borderRadius,
					backgroundColor: "#E0E0E0",
					opacity,
				},
				style,
			]}
		/>
	)
}

// Pre-built skeleton components
export function InspectionCardSkeleton() {
	return (
		<View className="bg-white p-4 mb-1 border-b border-[#e0e0e0]">
			<View className="flex-row justify-between items-center mb-2">
				<Skeleton width="60%" height={20} />
				<Skeleton width={80} height={24} borderRadius={12} />
			</View>
			<Skeleton width="80%" height={16} style={{ marginBottom: 8 }} />
			<View className="flex-row justify-between items-center">
				<Skeleton width={100} height={14} />
				<Skeleton width={40} height={14} />
			</View>
		</View>
	)
}

export function InspectionListSkeleton() {
	return (
		<View className="p-4">
			{[1, 2, 3, 4, 5, 6].map((i) => (
				<InspectionCardSkeleton key={i} />
			))}
		</View>
	)
}

export function InspectionDetailSkeleton() {
	return (
		<View className="p-4">
			{/* Header */}
			<View className="bg-white rounded-xl p-4 mb-4">
				<Skeleton width="40%" height={20} style={{ marginBottom: 12 }} />
				<Skeleton width="100%" height={16} style={{ marginBottom: 8 }} />
				<Skeleton width="100%" height={16} style={{ marginBottom: 8 }} />
				<Skeleton width="80%" height={16} />
			</View>

			{/* Checklist */}
			<View className="bg-white rounded-xl p-4 mb-4">
				<Skeleton width="30%" height={20} style={{ marginBottom: 12 }} />
				{[1, 2, 3].map((i) => (
					<View key={i} className="mb-4">
						<Skeleton width="60%" height={14} style={{ marginBottom: 8 }} />
						<View className="flex-row gap-2">
							<Skeleton width={80} height={40} borderRadius={8} />
							<Skeleton width={80} height={40} borderRadius={8} />
							<Skeleton width={80} height={40} borderRadius={8} />
						</View>
					</View>
				))}
			</View>

			{/* Photos */}
			<View className="bg-white rounded-xl p-4">
				<Skeleton width="20%" height={20} style={{ marginBottom: 12 }} />
				<View className="flex-row gap-2">
					<Skeleton width={100} height={100} borderRadius={8} />
					<Skeleton width={100} height={100} borderRadius={8} />
					<Skeleton width={100} height={100} borderRadius={8} />
				</View>
			</View>
		</View>
	)
}
