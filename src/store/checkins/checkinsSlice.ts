import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { loggedOut } from '@/store/auth/authSlice';
import type { CheckIn, CheckInDraft } from '@/domain/checkins/types';

export type CheckInsState = {
  byId: Record<string, CheckIn>;
  allIds: string[];
  /** When the list last came from the server. Null while purely local. */
  fetchedAt: number | null;
  /** A request is on the wire right now. */
  loading: boolean;
  /**
   * When a fetch was last attempted, succeeded or not. Distinct from
   * `fetchedAt`, and that is what stops the empty state flashing: between a
   * screen mounting and its request starting, `loading` is false and nothing
   * has been fetched — which looks identical to an account with no check-ins.
   */
  lastAttemptAt: number | null;
  /**
   * The last pull did not come back with a list. Purely a display fact — the
   * check-ins are untouched — but without it the user cannot tell "nothing
   * new" from "we could not reach the server".
   */
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
    /**
     * The whole list, reconciled from `GET /checkins` plus anything still
     * queued — never the raw server response. `at` is passed in because a
     * reducer that calls `Date.now()` is not a pure function of its inputs.
     */
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
      // A list arrived, so whatever went wrong last time is over.
      state.lastPullFailed = false;
    },
    /**
     * Takes a complete check-in rather than minting the id: the caller needs
     * the id to queue a sync op against it. `createCheckIn` in
     * checkinsCommands is the only thing that should dispatch this.
     */
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
    /**
     * Puts a check-in back exactly as it was when a queued change is abandoned.
     * A full replace rather than a patch — merging would leave fields from the
     * very change being undone.
     */
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
    /** Marks the attempt as well, so a failure still counts as "we asked". */
    checkInsFetchStarted(state, action: PayloadAction<number>) {
      state.loading = true;
      state.lastAttemptAt = action.payload;
    },
    /**
     * The request finished without a usable list. `lastAttemptAt` stays set so
     * the screens stop waiting and show what is on the device.
     */
    checkInsFetchFailed(state) {
      state.loading = false;
      // Deliberately leaves `byId`/`allIds` alone: a refresh that could not
      // reach the server says nothing about what the user has, and clearing
      // them would turn a dropped connection into data loss.
      state.lastPullFailed = true;
    },
  },
  extraReducers: builder => {
    // Handled here rather than at the call site so nothing has to remember
    // this slice — one action tears the whole account down.
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
