import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { loggedOut } from '@/store/auth/authSlice';

export type ProfileState = {
  name: string;
  baselineWeightKg: number | null;
  heightCm: number | null;
  stepGoal: number | null;
  waterGoalMl: number | null;
  sleepGoalMinutes: number | null;
  targetWeightKg: number | null;
  baselineSetAt: number | null;
  isComplete: boolean;
  pendingSync: boolean;
  syncFailed: boolean;
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
    profileCompleted(
      _state,
      action: PayloadAction<ProfileDraft & { baselineSetAt: number }>,
    ) {
      return {
        ...action.payload,
        isComplete: true,
        pendingSync: true,
        syncFailed: false,
        lastError: null,
      };
    },
    profileHydrated(
      state,
      action: PayloadAction<Omit<ProfileDraft, 'name'> & { name: string }>,
    ) {
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
    profileEdited(state, action: PayloadAction<Partial<ProfileDraft>>) {
      for (const [key, value] of Object.entries(action.payload)) {
        if (value !== undefined) {
          Object.assign(state, { [key]: value });
        }
      }
      state.pendingSync = true;
      state.syncFailed = false;
      state.lastError = null;
    },
    profileSynced(state) {
      state.pendingSync = false;
      state.syncFailed = false;
      state.lastError = null;
    },
    profileSyncFailed(state, action: PayloadAction<string>) {
      state.syncFailed = true;
      state.lastError = action.payload;
    },
    profileSyncRetryRequested(state) {
      state.syncFailed = false;
      state.lastError = null;
    },
    profileDiscarded(state) {
      state.pendingSync = false;
      state.syncFailed = false;
      state.lastError = null;
    },
    profileReset() {
      return initialProfileState;
    },
  },
  extraReducers: builder => {
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
