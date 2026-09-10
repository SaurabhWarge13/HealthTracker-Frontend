import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { loggedOut } from '@/store/auth/authSlice';

export type HealthConnectStatus =
  /** Terminal: nothing to offer the user. */
  | 'NOT_SUPPORTED'
  /** Recoverable: installable and absent (Android 9-13). */
  | 'PROVIDER_MISSING'
  /** Recoverable: in the OS but switched off (Android 14+). */
  | 'PROVIDER_DISABLED'
  /** Recoverable: installed but too old to read from. */
  | 'UPDATE_REQUIRED'
  | 'NOT_CONNECTED'
  | 'PARTIALLY_CONNECTED'
  | 'CONNECTED';

/** Availability is separate from freshness on purpose. */
export type FieldAvailability = 'AVAILABLE' | 'NO_DATA' | 'PERMISSION_DENIED';

export type HealthConnectField = 'weight' | 'height' | 'steps' | 'sleep' | 'water';

export type TodayReadings = {
  steps: number | null;
  sleepMinutes: number | null;
  waterMl: number | null;
  /** Latest device weight — only ever surfaced as a nudge, never as a rival number. */
  weightKg: number | null;
  weightRecordedAt: number | null;
  /** Height barely moves, so this is the newest reading rather than today's. */
  heightCm: number | null;
  heightRecordedAt: number | null;
  /** When we last read from Health Connect, distinct from when it recorded. */
  syncedAt: number | null;
};

export type HealthConnectState = {
  status: HealthConnectStatus;
  availability: Record<HealthConnectField, FieldAvailability>;
  today: TodayReadings;
  /** Reading whose nudge the user already dismissed, so we never nag twice. */
  dismissedWeightAt: number | null;
  /** A read is in flight; screens use it to disable Connect, not to blank data. */
  syncing: boolean;
  lastError: string | null;
  /**
   * Whether the device has been asked yet since launch.
   *
   * This slice is never persisted — it is device truth, re-read on every
   * foreground — so at cold start it holds defaults, not facts. Without this
   * flag "we have not looked" is indistinguishable from "not connected", and
   * a returning user would be shown the connect prompt for the few hundred
   * milliseconds the first read takes.
   */
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
    /**
     * Dispatched by useHealthConnect after reading permissions and records —
     * on connect, and again on every app resume, so a permission
     * revoked in Android settings is reflected the moment the user returns.
     */
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
    /** Keeps the last good readings on screen rather than blanking the card. */
    healthConnectSyncFailed(state, action: PayloadAction<string>) {
      state.syncing = false;
      state.lastError = action.payload;
      // A failed check is still a check — it must not leave the card waiting
      // forever on an answer that is not coming.
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
    /**
     * Logout is the account boundary (authSlice). Handled here rather than in
     * SettingsScreen so no call site has to remember this slice, mirroring
     * settingsSlice — one action tears the whole account down.
     */
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
