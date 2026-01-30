// Types definitions for navigation parameters in the app

export type RootStackParamList = {
	Main: undefined
	Auth: undefined
}

export type AuthStackParamList = {
	Login: undefined
	Signup: undefined
}

export type MainStackParamList = {
	Home: undefined
	CreateInspection: undefined
	InspectionDetail: { id: string }
	FailedInspection: { inspectionId: string }
	ConflictResolution: { inspectionId: string }
	Profile: undefined
}
