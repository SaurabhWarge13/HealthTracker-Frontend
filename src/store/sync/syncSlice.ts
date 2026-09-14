import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { loggedOut } from '@/store/auth/authSlice';
import { mergePendingOp, type PendingOp } from '@/domain/sync';
import { isLocalId } from '@/utils/uuid';
import type { ApiErrorKind } from '@/domain/api/errors';

const TRANSIENT: ReadonlySet<ApiErrorKind> = new Set<ApiErrorKind>([
  'offline',
  'network',
  'timeout',
  'server',
]);

export type SyncState = {
  ops: PendingOp[];
  serverIds: Record<string, string>;
  inFlightOpId: string | null;
  lastSyncedAt: number | null;
};

export const initialSyncState: SyncState = {
  ops: [],
  serverIds: {},
  inFlightOpId: null,
  lastSyncedAt: null,
};

const syncSlice = createSlice({
  name: 'sync',
  initialState: initialSyncState,
  reducers: {
    opEnqueued(state, action: PayloadAction<PendingOp>) {
      const incoming = action.payload;
      const index = state.ops.findIndex(
        op => op.entityId === incoming.entityId && op.opId !== state.inFlightOpId,
      );

      if (index === -1) {
        state.ops.push(incoming);
        return;
      }

      const merged = mergePendingOp(state.ops[index], incoming);
      if (merged === null) {
        state.ops.splice(index, 1);
      } else {
        state.ops[index] = merged;
      }
    },

    opStarted(state, action: PayloadAction<string>) {
      state.inFlightOpId = action.payload;
    },

    opSucceeded(
      state,
      action: PayloadAction<{
        opId: string;
        entityId: string;
        serverId?: string;
        at: number;
        forget?: boolean;
      }>,
    ) {
      state.ops = state.ops.filter(op => op.opId !== action.payload.opId);
      state.inFlightOpId = null;
      state.lastSyncedAt = action.payload.at;
      if (action.payload.serverId !== undefined) {
        state.serverIds[action.payload.entityId] = action.payload.serverId;
      }
      if (action.payload.forget === true) {
        delete state.serverIds[action.payload.entityId];
      }
    },

    opRetryScheduled(
      state,
      action: PayloadAction<{
        opId: string;
        nextAttemptAt: number;
        message: string;
        kind: ApiErrorKind;
      }>,
    ) {
      const op = state.ops.find(entry => entry.opId === action.payload.opId);
      if (op !== undefined) {
        op.attempts += 1;
        op.nextAttemptAt = action.payload.nextAttemptAt;
        op.lastError = action.payload.message;
        op.lastErrorKind = action.payload.kind;
      }
      state.inFlightOpId = null;
    },

    opFailed(
      state,
      action: PayloadAction<{ opId: string; message: string; kind: ApiErrorKind }>,
    ) {
      const op = state.ops.find(entry => entry.opId === action.payload.opId);
      if (op !== undefined) {
        op.failed = true;
        op.lastError = action.payload.message;
        op.lastErrorKind = action.payload.kind;
      }
      state.inFlightOpId = null;
    },

    opRetryRequested(state, action: PayloadAction<{ opId: string; at: number }>) {
      const op = state.ops.find(entry => entry.opId === action.payload.opId);
      if (op !== undefined) {
        op.failed = false;
        op.attempts = 0;
        op.nextAttemptAt = action.payload.at;
        op.lastError = null;
        op.lastErrorKind = null;
      }
    },

    transientFailuresRevived(state, action: PayloadAction<number>) {
      for (const op of state.ops) {
        if (op.failed && op.lastErrorKind !== null && TRANSIENT.has(op.lastErrorKind)) {
          op.failed = false;
          op.attempts = 0;
          op.nextAttemptAt = action.payload;
          op.lastError = null;
          op.lastErrorKind = null;
        }
      }
    },

    opDiscarded(state, action: PayloadAction<string>) {
      state.ops = state.ops.filter(op => op.opId !== action.payload);
    },

    syncCleared() {
      return initialSyncState;
    },

    serverIdsRecorded(state, action: PayloadAction<Record<string, string>>) {
      state.serverIds = { ...state.serverIds, ...action.payload };
    },

    staleServerIdsPruned(state, action: PayloadAction<{ keep: readonly string[] }>) {
      const keep = new Set(action.payload.keep);
      for (const op of state.ops) {
        keep.add(op.entityId);
      }

      for (const [localId, serverId] of Object.entries(state.serverIds)) {
        const redundant = localId === serverId && !isLocalId(localId);
        if (redundant || !keep.has(localId)) {
          delete state.serverIds[localId];
        }
      }
    },

    inFlightCleared(state) {
      state.inFlightOpId = null;
    },
  },
  extraReducers: builder => {
    builder.addCase(loggedOut, () => initialSyncState);
  },
});

export const {
  opEnqueued,
  opStarted,
  opSucceeded,
  opRetryScheduled,
  opFailed,
  opRetryRequested,
  transientFailuresRevived,
  opDiscarded,
  syncCleared,
  serverIdsRecorded,
  staleServerIdsPruned,
  inFlightCleared,
} = syncSlice.actions;

export const syncReducer = syncSlice.reducer;
