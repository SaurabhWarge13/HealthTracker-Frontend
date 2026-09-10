import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type ConnectivityState = {
  /** `isConnected` AND not known-unreachable — see networkService. */
  isOnline: boolean;
  /** Null until the platform has decided; a captive portal reads false. */
  isInternetReachable: boolean | null;
  /** Drives the sync engine: a transition to online is a reason to drain. */
  lastChangedAt: number | null;
};

/**
 * Optimistic by default. Assuming offline before NetInfo has answered would
 * flash the offline banner on every cold start.
 */
export const initialConnectivityState: ConnectivityState = {
  isOnline: true,
  isInternetReachable: null,
  lastChangedAt: null,
};

const connectivitySlice = createSlice({
  name: 'connectivity',
  initialState: initialConnectivityState,
  reducers: {
    connectivityChanged(
      state,
      action: PayloadAction<{
        isOnline: boolean;
        isInternetReachable: boolean | null;
        at: number;
      }>,
    ) {
      const changed = state.isOnline !== action.payload.isOnline;
      state.isOnline = action.payload.isOnline;
      state.isInternetReachable = action.payload.isInternetReachable;
      if (changed) {
        state.lastChangedAt = action.payload.at;
      }
    },
  },
});

export const { connectivityChanged } = connectivitySlice.actions;

export const connectivityReducer = connectivitySlice.reducer;
