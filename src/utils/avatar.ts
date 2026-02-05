// src/utils/avatar.ts

export function getInitials(firstName?: string, lastName?: string): string {
	if (!firstName && !lastName) {
		return "?"
	}

	const firstInitial = firstName?.charAt(0).toUpperCase() || ""
	const lastInitial = lastName?.charAt(0).toUpperCase() || ""

	return `${firstInitial}${lastInitial}`.trim() || "?"
}

export function getAvatarColor(name: string): string {
	// Generate consistent color based on name
	const colors = [
		"#FF6B6B",
		"#4ECDC4",
		"#45B7D1",
		"#FFA07A",
		"#98D8C8",
		"#F7DC6F",
		"#BB8FCE",
		"#85C1E2",
	]

	const hash = name.split("").reduce((acc, char) => {
		return char.charCodeAt(0) + ((acc << 5) - acc)
	}, 0)

	return colors[Math.abs(hash) % colors.length]
}
