import { createSelector } from '@reduxjs/toolkit';
import { isLocalId } from '@/utils/uuid';
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
