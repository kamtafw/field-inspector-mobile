export type BootState =
	| { status: "idle" }
	| { status: "booting" }
	| { status: "ready" }
	| { status: "fatal"; error: Error }
