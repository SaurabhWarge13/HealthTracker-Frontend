import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { loggedOut } from '@/store/auth/authSlice';

export type ProfileState = {
  name: string;
  /** Required — the whole dashboard measures against it. */
  baselineWeightKg: number | null;
  /** Optional: without it BMI is an invitation, not a dead dash. */
  heightCm: number | null;
  stepGoal: number | null;
  /** Integer millilitres. */
  waterGoalMl: number | null;
  /** Minutes, matching `sleepMinutes`, even though the UI asks for hours. */
  sleepGoalMinutes: number | null;
  /** May sit above or below the current weight. */
  targetWeightKg: number | null;
  /** When the baseline was set — the trend chart's first point sits here. */
  baselineSetAt: number | null;
  /** Drives RootNavigator's onboarding → main switch. */
  isComplete: boolean;
  /**
   * Local edits the server has not accepted yet. A single flag rather than a
   * queue because `PUT /profile` is a full replace, so five pending field
   * edits and one are the same request. Check-ins need a real outbox because
   * each is a separate row; the profile does not.
   */
  pendingSync: boolean;
  /**
   * The push was rejected for a reason another attempt cannot fix. Without
   * this the engine refired the same doomed request on every mount, foreground
   * and reconnect, forever. `pendingSync` stays true alongside it: the edit is
   * still only on this device, and still counts as unsynced work at logout.
   */
  syncFailed: boolean;
  /** Why it failed, in the user's words. Shown in Settings. */
  lastError: string | null;
};

export const initialProfileState: ProfileState = {
  name: '',
  baselineWeightKg: null,
  heightCm: null,
  stepGoal: null,
  waterGoalMl: null,
  sleepGoalMinutes: null,
  targetWeightKg: null,
  baselineSetAt: null,
  isComplete: false,
  pendingSync: false,
  syncFailed: false,
  lastError: null,
};

export type ProfileDraft = Omit<
  ProfileState,
  'isComplete' | 'baselineSetAt' | 'pendingSync' | 'syncFailed' | 'lastError'
>;

const profileSlice = createSlice({
  name: 'profile',
  initialState: initialProfileState,
  reducers: {
    /** The only path to the dashboard: copies the onboarding draft across. */
    profileCompleted(
      _state,
      action: PayloadAction<ProfileDraft & { baselineSetAt: number }>,
    ) {
      return {
        ...action.payload,
        isComplete: true,
        // Onboarding must not depend on a network, so the profile is written
        // locally and pushed by the sync engine when it can be.
        pendingSync: true,
        syncFailed: false,
        lastError: null,
      };
    },
    /**
     * Filled in from `GET /profile`. The server answering at all means the
     * account is set up, so `isComplete` follows — that is what stops a second
     * device walking the user through onboarding again.
     *
     * `baselineSetAt` is untouched: the server has no field for it, and
     * `updatedAt` cannot stand in because it moves on every goal edit.
     */
    profileHydrated(
      state,
      action: PayloadAction<Omit<ProfileDraft, 'name'> & { name: string }>,
    ) {
      // A local edit that has not reached the server is newer than what the
      // server holds, so it wins — overwriting here would make an offline
      // edit visibly revert.
      if (state.pendingSync) {
        return state;
      }
      return {
        ...state,
        ...action.payload,
        baselineSetAt: state.baselineSetAt,
        isComplete: true,
        pendingSync: false,
        syncFailed: false,
        lastError: null,
      };
    },
    /**
     * One field at a time, from Settings. Only defined keys are applied:
     * spreading a `Partial` wholesale would let an explicit `undefined`
     * overwrite a real value, and since PUT is a full replace, a half-formed
     * profile here becomes a half-erased one on the server. `null` still
     * clears a field, as it should.
     */
    profileEdited(state, action: PayloadAction<Partial<ProfileDraft>>) {
      for (const [key, value] of Object.entries(action.payload)) {
        if (value !== undefined) {
          Object.assign(state, { [key]: value });
        }
      }
      state.pendingSync = true;
      // A fresh edit is new work, not the rejected one: it deserves an
      // attempt of its own rather than inheriting the old failure.
      state.syncFailed = false;
      state.lastError = null;
    },
    /** The server has the current profile. */
    profileSynced(state) {
      state.pendingSync = false;
      state.syncFailed = false;
      state.lastError = null;
    },
    /**
     * The push was rejected in a way retrying cannot fix. `pendingSync` stays
     * true — the edit is still only here — but the engine stops re-sending it
     * and Settings offers the user a way out.
     */
    profileSyncFailed(state, action: PayloadAction<string>) {
      state.syncFailed = true;
      state.lastError = action.payload;
    },
    /** User pressed Retry: re-arm the push without touching their values. */
    profileSyncRetryRequested(state) {
      state.syncFailed = false;
      state.lastError = null;
    },
    /**
     * Clears the flags only — the caller replaces the values with the server's
     * copy immediately afterwards (see `useProfileDiscard`). The order
     * matters: `profileHydrated` refuses to overwrite while `pendingSync` is
     * true, so the flags have to fall first.
     */
    profileDiscarded(state) {
      state.pendingSync = false;
      state.syncFailed = false;
      state.lastError = null;
    },
    /** A different account signing in, or a reset back through onboarding. */
    profileReset() {
      return initialProfileState;
    },
  },
  extraReducers: builder => {
    // Handled here rather than at the call site so nothing has to remember
    // this slice — one action tears the whole account down.
    builder.addCase(loggedOut, () => initialProfileState);
  },
});

export const {
  profileCompleted,
  profileHydrated,
  profileEdited,
  profileSynced,
  profileSyncFailed,
  profileSyncRetryRequested,
  profileDiscarded,
  profileReset,
} = profileSlice.actions;

export const profileReducer = profileSlice.reducer;
