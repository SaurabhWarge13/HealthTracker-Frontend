import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export type Connectivity = {
  isOnline: boolean;
  isInternetReachable: boolean | null;
};

export function toConnectivity(state: NetInfoState): Connectivity {
  const reachable = state.isInternetReachable;
  return {
    isOnline: state.isConnected === true && reachable !== false,
    isInternetReachable: reachable,
  };
}

/**
 * NetInfo emits the current state on subscribe, so there is no separate
 * one-shot read: subscribing is how the app learns where it stands.
 */
export function subscribeToConnectivity(
  onChange: (value: Connectivity) => void,
): () => void {
  return NetInfo.addEventListener(state => onChange(toConnectivity(state)));
}
