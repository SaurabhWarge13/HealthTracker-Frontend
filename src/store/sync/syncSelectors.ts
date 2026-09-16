import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@/store/rootReducer';

const selectOps = (state: RootState) => state.sync.ops;

const selectPendingOps = createSelector(selectOps, ops =>
  ops.filter(op => !op.failed),
);

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

const selectProfileUnsynced = (state: RootState) =>
  state.profile.pendingSync || state.profile.syncFailed;

export const selectUnsyncedCount = createSelector(
  selectOps,
  selectProfileUnsynced,
  (ops, profileUnsynced) => ops.length + (profileUnsynced ? 1 : 0),
);

export const selectPendingEntityIds = createSelector(
  selectPendingOps,
  ops => new Set(ops.map(op => op.entityId)),
);

export const selectFailedEntityIds = createSelector(
  selectFailedOps,
  ops => new Set(ops.map(op => op.entityId)),
);

export const selectNextDueOp = (now: number) => (state: RootState) =>
  state.sync.ops.find(
    op =>
      !op.failed &&
      op.opId !== state.sync.inFlightOpId &&
      op.nextAttemptAt <= now,
  ) ?? null;

export const selectNextAttemptAt = createSelector(selectPendingOps, ops => {
  const times = ops.map(op => op.nextAttemptAt);
  return times.length > 0 ? Math.min(...times) : null;
});
