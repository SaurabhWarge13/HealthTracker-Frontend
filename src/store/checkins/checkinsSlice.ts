import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { loggedOut } from '@/store/auth/authSlice';
import type { CheckIn, CheckInDraft } from '@/domain/checkins/types';

export type CheckInsState = {
  byId: Record<string, CheckIn>;
  allIds: string[];
  fetchedAt: number | null;
  loading: boolean;
  lastAttemptAt: number | null;
  lastPullFailed: boolean;
};

export const initialCheckInsState: CheckInsState = {
  byId: {},
  allIds: [],
  fetchedAt: null,
  loading: false,
  lastAttemptAt: null,
  lastPullFailed: false,
};

const checkinsSlice = createSlice({
  name: 'checkins',
  initialState: initialCheckInsState,
  reducers: {
    checkInsReplaced(
      state,
      action: PayloadAction<{ entries: CheckIn[]; at: number }>,
    ) {
      state.byId = {};
      state.allIds = [];
      for (const entry of action.payload.entries) {
        state.byId[entry.id] = entry;
        state.allIds.push(entry.id);
      }
      state.fetchedAt = action.payload.at;
      state.loading = false;
      state.lastPullFailed = false;
    },
    checkInCreated(state, action: PayloadAction<CheckIn>) {
      state.byId[action.payload.id] = action.payload;
      state.allIds.push(action.payload.id);
    },
    checkInUpdated(
      state,
      action: PayloadAction<{ id: string; changes: Partial<CheckInDraft> }>,
    ) {
      const existing = state.byId[action.payload.id];
      if (existing) {
        state.byId[action.payload.id] = { ...existing, ...action.payload.changes };
      }
    },
    checkInDeleted(state, action: PayloadAction<string>) {
      delete state.byId[action.payload];
      state.allIds = state.allIds.filter(id => id !== action.payload);
    },
    checkInRestored(state, action: PayloadAction<CheckIn>) {
      const entry = action.payload;
      state.byId[entry.id] = entry;
      if (!state.allIds.includes(entry.id)) {
        state.allIds.push(entry.id);
      }
    },
    checkInsCleared() {
      return initialCheckInsState;
    },
    checkInsFetchStarted(state, action: PayloadAction<number>) {
      state.loading = true;
      state.lastAttemptAt = action.payload;
    },
    checkInsFetchFailed(state) {
      state.loading = false;
      state.lastPullFailed = true;
    },
  },
  extraReducers: builder => {
    builder.addCase(loggedOut, () => initialCheckInsState);
  },
});

export const {
  checkInsReplaced,
  checkInCreated,
  checkInUpdated,
  checkInDeleted,
  checkInRestored,
  checkInsCleared,
  checkInsFetchStarted,
  checkInsFetchFailed,
} = checkinsSlice.actions;

export const checkinsReducer = checkinsSlice.reducer;
