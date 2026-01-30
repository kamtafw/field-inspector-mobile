import * as Network from "expo-network"
import NetInfo, { NetInfoState } from "@react-native-community/netinfo"

export type NetworkStatus = "online" | "offline" | "unknown"

class NetworkMonitor {
	private status: NetworkStatus = "unknown"
	private listeners: Array<(status: NetworkStatus) => void> = []
	private netInfoUnsubscribe?: () => void
	private debounceTimeout?: NodeJS.Timeout

	/** Initialize network monitoring */
	initialize() {
		console.log("🌐 NetworkMonitor: Initializing...")

		this.netInfoUnsubscribe = NetInfo.addEventListener((state) => {
			this.handleNetworkChange(state)
		})

		// get initial state
		NetInfo.fetch().then((state) => {
			this.handleNetworkChange(state)
		})
	}

	/** Cleanup */
	cleanup() {
		if (this.netInfoUnsubscribe) {
			this.netInfoUnsubscribe()
		}
	}

	/** Handle network state changes */
	private handleNetworkChange(state: NetInfoState) {
		const newStatus: NetworkStatus = state.isConnected ? "online" : "offline"

		// debounce rapid state changes
		if (this.debounceTimeout) {
			clearTimeout(this.debounceTimeout)
		}

		this.debounceTimeout = setTimeout(() => {
			if (newStatus !== this.status) {
				const oldStatus = this.status
				this.status = newStatus

				console.log(`🌐 Network status changed: ${oldStatus} → ${newStatus}`)

				if (newStatus === "online") {
					console.log("⏳ Waiting 2s before starting sync...")
					setTimeout(() => {
						this.notifyListeners()
					}, 2000)
				} else {
					this.notifyListeners()
				}
			}
		}, 1000)
	}

	/** Get current network status */
	getStatus(): NetworkStatus {
		return this.status
	}

	/** Check if currently online */
	isOnline(): boolean {
		return this.status === "online"
	}

	/** Subscribe to network status changes */
	addListener(callback: (status: NetworkStatus) => void): () => void {
		this.listeners.push(callback)

		// return unsubscribe function
		return () => this.removeListener(callback)
	}

	/** Unsubscribe to network status changes */
	removeListener(callback: (status: NetworkStatus) => void) {
		this.listeners = this.listeners.filter((cb) => cb !== callback)
	}

	/** Notify all listeners */
	private notifyListeners() {
		this.listeners.forEach((callback) => {
			try {
				callback(this.status)
			} catch (err) {
				console.error("Error in network listener:", err)
			}
		})
	}
}

export default new NetworkMonitor()
