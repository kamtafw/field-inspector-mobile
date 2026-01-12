import * as Network from "expo-network"
import NetInfo, { NetInfoState } from "@react-native-community/netinfo"

export type NetworkStatus = "online" | "offline" | "unknown"

// export type NetworkState = {
// 	isConnected: boolean
// 	isInternetReachable: boolean
// 	type: Network.NetworkStateType | null
// }

// type NetworkCallback = (state: Network.NetworkState) => void

// export function subscribeToNetworkChanges(callback: NetworkCallback) {
// 	const subscription = Network.addNetworkStateListener(callback)

// 	return () => subscription.remove()
// }

// export async function getNetworkState(): Promise<NetworkState> {
// 	const state = await Network.getNetworkStateAsync()

// 	return {
// 		isConnected: Boolean(state.isConnected),
// 		isInternetReachable: Boolean(state.isInternetReachable),
// 		type: state.type ?? null,
// 	}
// }

class NetworkMonitor {
	private status: NetworkStatus = "unknown"
	private listeners: Array<(status: NetworkStatus) => void> = []

	/** Initialize network monitoring */
	initialize() {
		NetInfo.addEventListener((state) => {
			this.handleNetworkChange(state)
		})

		NetInfo.fetch().then((state) => {
			this.handleNetworkChange(state)
		})
	}

	/** Handle network state changes */
	private handleNetworkChange(state: NetInfoState) {
		const newStatus: NetworkStatus = state.isConnected ? "online" : "offline"

		if (newStatus !== this.status) {
			console.log(`🌐 Network status changed: ${this.status} → ${newStatus}`)
			this.status = newStatus
			this.notifyListeners()
		}
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
	addListener(callback: (status: NetworkStatus) => void) {
		this.listeners.push(callback)
	}

	/** Unsubscribe to network status changes */
	removeListener(callback: (status: NetworkStatus) => void) {
		this.listeners = this.listeners.filter((cb) => cb !== callback)
	}

	/** Notify all listeners */
	private notifyListeners() {
		this.listeners.forEach((callback) => callback(this.status))
	}
}

export default new NetworkMonitor()
