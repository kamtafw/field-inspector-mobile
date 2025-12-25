import * as Network from "expo-network"

export type NetworkState = {
	isConnected: boolean
	isInternetReachable: boolean
	type: Network.NetworkStateType | null
}

type NetworkCallback = (state: Network.NetworkState) => void

export function subscribeToNetworkChanges(callback: NetworkCallback) {
	const subscription = Network.addNetworkStateListener(callback)

	return () => subscription.remove()
}

export async function getNetworkState(): Promise<NetworkState> {
	const state = await Network.getNetworkStateAsync()

	return {
		isConnected: Boolean(state.isConnected),
		isInternetReachable: Boolean(state.isInternetReachable),
		type: state.type ?? null,
	}
}
