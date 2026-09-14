import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type ConnectivityState = {
  isOnline: boolean;
  isInternetReachable: boolean | null;
  lastChangedAt: number | null;
};

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
