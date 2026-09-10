import { createSelector } from '@reduxjs/toolkit';
import { isLocalId } from '@/utils/uuid';
import type { RootState } from '@/store/rootReducer';

const selectOps = (state: RootState) => state.sync.ops;

const selectPendingOps = createSelector(selectOps, ops =>
  ops.filter(op => !op.failed),
);

/** Failed ops are held for the user to retry or discard; they never auto-send. */
export const selectFailedOps = createSelector(selectOps, ops =>
  ops.filter(op => op.failed),
);

export const selectPendingCount = createSelector(
  selectPendingOps,
  ops => ops.length,
);

export const selectFailedCount = createSelector(
  selectFailedOps,
  ops => ops.length,
);

/** Check-ins whose row should show the waiting-to-sync clock. */
export const selectPendingEntityIds = createSelector(
  selectPendingOps,
  ops => new Set(ops.map(op => op.entityId)),
);

export const selectFailedEntityIds = createSelector(
  selectFailedOps,
  ops => new Set(ops.map(op => op.entityId)),
);

/**
 * The next op the engine should send: not failed, not already in flight, and
 * past its backoff window. Ops stay in queue order so a create always precedes
 * the update that depends on it.
 */
export const selectNextDueOp = (now: number) => (state: RootState) =>
  state.sync.ops.find(
    op =>
      !op.failed &&
      op.opId !== state.sync.inFlightOpId &&
      op.nextAttemptAt <= now,
  ) ?? null;

/** When to wake up for the earliest scheduled retry, if any. */
export const selectNextAttemptAt = createSelector(selectPendingOps, ops => {
  const times = ops.map(op => op.nextAttemptAt);
  return times.length > 0 ? Math.min(...times) : null;
});

/**
 * The id to send to the server for a check-in. A local id with no mapping has
 * never been created server-side — compaction already guarantees an update or
 * delete never reaches the engine in that state, and returning null keeps it
 * impossible rather than merely unlikely.
 */
export const resolveServerId = (
  entityId: string,
  serverIds: Readonly<Record<string, string>>,
): string | null => {
  const mapped = serverIds[entityId];
  if (mapped !== undefined) {
    return mapped;
  }
  return isLocalId(entityId) ? null : entityId;
};
