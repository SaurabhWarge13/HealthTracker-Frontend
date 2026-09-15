import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { loggedOut } from '@/store/auth/authSlice';

export type HealthConnectStatus =
  | 'NOT_SUPPORTED'
  | 'PROVIDER_MISSING'
  | 'PROVIDER_DISABLED'
  | 'UPDATE_REQUIRED'
  | 'NOT_CONNECTED'
  | 'PARTIALLY_CONNECTED'
  | 'CONNECTED';

export type FieldAvailability = 'AVAILABLE' | 'NO_DATA' | 'PERMISSION_DENIED';

export type FieldConnection = 'connected' | 'notConnected';

export type HealthConnectField = 'weight' | 'height' | 'steps' | 'sleep' | 'water';

export type TodayReadings = {
  steps: number | null;
  sleepMinutes: number | null;
  waterMl: number | null;
  weightKg: number | null;
  weightRecordedAt: number | null;
  heightCm: number | null;
  heightRecordedAt: number | null;
  syncedAt: number | null;
};

export type HealthConnectState = {
  status: HealthConnectStatus;
  availability: Record<HealthConnectField, FieldAvailability>;
  today: TodayReadings;
  dismissedWeightAt: number | null;
  syncing: boolean;
  lastError: string | null;
  hasChecked: boolean;
};

const DENIED: Record<HealthConnectField, FieldAvailability> = {
  weight: 'PERMISSION_DENIED',
  height: 'PERMISSION_DENIED',
  steps: 'PERMISSION_DENIED',
  sleep: 'PERMISSION_DENIED',
  water: 'PERMISSION_DENIED',
};

export const initialHealthConnectState: HealthConnectState = {
  status: 'NOT_CONNECTED',
  availability: DENIED,
  today: {
    steps: null,
    sleepMinutes: null,
    waterMl: null,
    weightKg: null,
    weightRecordedAt: null,
    heightCm: null,
    heightRecordedAt: null,
    syncedAt: null,
  },
  dismissedWeightAt: null,
  syncing: false,
  lastError: null,
  hasChecked: false,
};

const healthConnectSlice = createSlice({
  name: 'healthConnect',
  initialState: initialHealthConnectState,
  reducers: {
    healthConnectSyncStarted(state) {
      state.syncing = true;
      state.lastError = null;
    },
    healthConnectSynced(
      state,
      action: PayloadAction<{
        status: HealthConnectStatus;
        availability?: Partial<Record<HealthConnectField, FieldAvailability>>;
        today?: Partial<TodayReadings>;
      }>,
    ) {
      state.status = action.payload.status;
      if (action.payload.availability) {
        state.availability = { ...state.availability, ...action.payload.availability };
      }
      if (action.payload.today) {
        state.today = { ...state.today, ...action.payload.today };
      }
      state.syncing = false;
      state.lastError = null;
      state.hasChecked = true;
    },
    healthConnectSyncFailed(state, action: PayloadAction<string>) {
      state.syncing = false;
      state.lastError = action.payload;
      state.hasChecked = true;
    },
    weightNudgeDismissed(state) {
      state.dismissedWeightAt = state.today.weightRecordedAt;
    },
    healthConnectReset() {
      return initialHealthConnectState;
    },
  },
  extraReducers: builder => {
    builder.addCase(loggedOut, () => initialHealthConnectState);
  },
});

export const {
  healthConnectSyncStarted,
  healthConnectSynced,
  healthConnectSyncFailed,
  weightNudgeDismissed,
  healthConnectReset,
} = healthConnectSlice.actions;

export const healthConnectReducer = healthConnectSlice.reducer;
