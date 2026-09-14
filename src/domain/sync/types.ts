import type { CheckIn } from '@/domain/checkins/types';
import type { ApiErrorKind } from '@/domain/api/errors';

export type SyncOpKind = 'create' | 'update' | 'delete';

export type PendingOp = {
  opId: string;
  kind: SyncOpKind;
  entityId: string;
  payload: CheckIn | null;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  failed: boolean;
  lastError: string | null;
  lastErrorKind: ApiErrorKind | null;
  before: CheckIn | null;
};

export const normalizePendingOp = (op: PendingOp): PendingOp => ({
  ...op,
  before: op.before ?? null,
  lastErrorKind: op.lastErrorKind ?? null,
});

export const makePendingOp = (
  opId: string,
  kind: SyncOpKind,
  entityId: string,
  payload: CheckIn | null,
  now: number,
  before: CheckIn | null = null,
): PendingOp => ({
  opId,
  kind,
  entityId,
  payload,
  createdAt: now,
  attempts: 0,
  nextAttemptAt: now,
  failed: false,
  lastError: null,
  lastErrorKind: null,
  before,
});
