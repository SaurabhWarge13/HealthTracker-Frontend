/**
 * The offline queue's vocabulary. An op records that the server has not heard
 * about a check-in yet, and is persisted alongside the data it describes.
 */
import type { CheckIn } from '@/domain/checkins/types';
import type { ApiErrorKind } from '@/domain/api/errors';

export type SyncOpKind = 'create' | 'update' | 'delete';

export type PendingOp = {
  opId: string;
  kind: SyncOpKind;
  /**
   * The client's own id, stable for the check-in's whole life — rewriting ids
   * on sync would break open screens and deep links to an offline creation.
   */
  entityId: string;
  /**
   * The complete check-in for create and update, null for delete. Complete
   * rather than a diff because the server's PUT is a full replace, and because
   * it makes compaction exact: the newest payload wins.
   */
  payload: CheckIn | null;
  createdAt: number;
  /** How many times this has been sent and failed. */
  attempts: number;
  /** Epoch ms. The engine leaves the op alone until this passes. */
  nextAttemptAt: number;
  /**
   * Given up on. Failed ops stop blocking the queue but stay visible, because
   * quietly dropping someone's check-in is not an option.
   */
  failed: boolean;
  lastError: string | null;
  /**
   * Lets the engine tell a bad connection from a bad request: a transport
   * failure earns another go once the device is back online, a rejected
   * payload never will.
   */
  lastErrorKind: ApiErrorKind | null;
  /**
   * What local state returns to if the user abandons this op — null for a
   * create, since abandoning one means the check-in should not exist. The op
   * carries only the after state, so without this it cannot be reverted.
   */
  before: CheckIn | null;
};

/**
 * Fills in fields a stored op predates. Redux replaces a preloaded slice
 * rather than merging it, so an op queued by an older build arrives missing
 * every field added since — present in the type, absent at runtime.
 *
 * `before` is the dangerous one: it is read as `op.before === null`, which is
 * false for `undefined`, so the check falls through to code that dereferences
 * it. This runs before `compactOps`, so a merge cannot carry one forward.
 */
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
