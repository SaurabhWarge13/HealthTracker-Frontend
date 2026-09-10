import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { loggedOut } from '@/store/auth/authSlice';
import { mergePendingOp, type PendingOp } from '@/domain/sync';
import { isLocalId } from '@/utils/uuid';
import type { ApiErrorKind } from '@/domain/api/errors';

/**
 * Failures that say something about the connection rather than the request.
 * Mirrors `isRetryable` in domain/api/errors — kept as a set here because this
 * reducer must stay a pure function of its inputs.
 */
const TRANSIENT: ReadonlySet<ApiErrorKind> = new Set<ApiErrorKind>([
  'offline',
  'network',
  'timeout',
  'server',
]);

export type SyncState = {
  ops: PendingOp[];
  /** Local id → server id, for check-ins created on this device. */
  serverIds: Record<string, string>;
  /** The op currently on the wire; it must not be rewritten underneath. */
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
    /**
     * Merges into whatever is already queued for the same check-in, so a
     * flurry of edits becomes one request. An op already in flight is left
     * alone and the new one appended — rewriting a request mid-send would
     * either lose the edit or apply it twice.
     */
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

    /**
     * `serverId` is recorded rather than swapped into the check-in's id, so
     * open screens and deep links to an offline-created check-in keep working.
     */
    opSucceeded(
      state,
      action: PayloadAction<{
        opId: string;
        entityId: string;
        serverId?: string;
        at: number;
        /** Set for a delete: the mapping has nothing left to point at. */
        forget?: boolean;
      }>,
    ) {
      state.ops = state.ops.filter(op => op.opId !== action.payload.opId);
      state.inFlightOpId = null;
      state.lastSyncedAt = action.payload.at;
      if (action.payload.serverId !== undefined) {
        state.serverIds[action.payload.entityId] = action.payload.serverId;
      }
      // Otherwise the map keeps an entry for every check-in ever deleted, for
      // the life of the install — it is persisted.
      if (action.payload.forget === true) {
        delete state.serverIds[action.payload.entityId];
      }
    },

    /** Will be tried again later; the queue keeps its place. */
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

    /**
     * Given up on. The op stays queued and visible — the user decides whether
     * to retry or discard; the app does not throw away what they wrote.
     */
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

    /** User asked to try a failed op again. */
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

    /**
     * Gives ops that exhausted their ~2-minute retry budget against a bad
     * connection another go: coming back online is new information, and
     * otherwise a tunnel longer than that strands the op behind a card the
     * user has to find and tap for a failure that already resolved itself.
     *
     * Transport failures only — a rejected payload will be rejected again
     * however good the connection is.
     */
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

    /** User chose to abandon a failed op. Only ever their decision. */
    opDiscarded(state, action: PayloadAction<string>) {
      state.ops = state.ops.filter(op => op.opId !== action.payload);
    },

    /** Everything failed ops included — used when the whole account resets. */
    syncCleared() {
      return initialSyncState;
    },

    /** Records ids for check-ins that arrived already synced. */
    serverIdsRecorded(state, action: PayloadAction<Record<string, string>>) {
      state.serverIds = { ...state.serverIds, ...action.payload };
    },

    /**
     * Garbage-collects mappings nothing can still need. `opSucceeded`'s
     * `forget` only prunes a delete this device sent, so a row deleted on
     * another phone would otherwise leave its mapping behind for the life of
     * the install — and the map is persisted.
     *
     * The op scan happens inside the reducer rather than in the caller because
     * reading `state.ops` here is atomic: a drain can enqueue or resolve an op
     * during the pull's `await`, and computing the doomed keys outside would
     * race with that and could delete the server id an in-flight delete needs.
     *
     * Every op counts — pending, failed and in flight — and a failed delete is
     * exactly the case that must not lose its id while the user decides.
     */
    staleServerIdsPruned(state, action: PayloadAction<{ keep: readonly string[] }>) {
      const keep = new Set(action.payload.keep);
      for (const op of state.ops) {
        keep.add(op.entityId);
      }

      for (const [localId, serverId] of Object.entries(state.serverIds)) {
        // Carries no information: `resolveServerId` returns an unmapped
        // non-local id unchanged anyway. Local keys are excluded because a
        // `local_x → local_x` entry would mean the server adopted our id.

        const redundant = localId === serverId && !isLocalId(localId);
        if (redundant || !keep.has(localId)) {
          delete state.serverIds[localId];
        }
      }
    },

    /**
     * Releases the in-flight flag when a drain ends without the op resolving,
     * which would otherwise make every future drain skip it. Does not touch
     * `lastSyncedAt`: nothing was synced.
     */
    inFlightCleared(state) {
      state.inFlightOpId = null;
    },
  },
  extraReducers: builder => {
    // Handled here rather than at the call site so nothing has to remember
    // this slice — one action tears the whole account down.
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
