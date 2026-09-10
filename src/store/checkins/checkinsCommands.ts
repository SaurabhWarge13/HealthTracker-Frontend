import { makePendingOp, type SyncOpKind } from '@/domain/sync';
import type { CheckIn, CheckInDraft } from '@/domain/checkins/types';
import { createId } from '@/utils/uuid';
import type { AppDispatch } from '@/store/store';
import type { RootState } from '@/store/rootReducer';
import { opDiscarded, opEnqueued } from '@/store/sync/syncSlice';
import {
  checkInCreated,
  checkInDeleted,
  checkInRestored,
  checkInUpdated,
} from './checkinsSlice';

type Thunk<T = void> = (dispatch: AppDispatch, getState: () => RootState) => T;

const enqueue = (
  dispatch: AppDispatch,
  kind: SyncOpKind,
  entityId: string,
  payload: CheckIn | null,
  now: number,
  before: CheckIn | null,
): void => {
  dispatch(
    opEnqueued(makePendingOp(createId(), kind, entityId, payload, now, before)),
  );
};

/** Returns the new check-in's id so the caller can navigate to it. */
export const createCheckIn =
  (draft: CheckInDraft, now: number = Date.now()): Thunk<string> =>
  dispatch => {
    const checkIn: CheckIn = { ...draft, id: createId(), createdAt: now };
    dispatch(checkInCreated(checkIn));
    // No before: abandoning a create means the check-in should not exist.
    enqueue(dispatch, 'create', checkIn.id, checkIn, now, null);
    return checkIn.id;
  };

export const updateCheckIn =
  (id: string, changes: Partial<CheckInDraft>, now: number = Date.now()): Thunk =>
  (dispatch, getState) => {
    // Captured BEFORE the reducer runs — a moment later this is unrecoverable,
    // and without it Discard has nothing to put back.
    const before = getState().checkins.byId[id] ?? null;

    dispatch(checkInUpdated({ id, changes }));
    // Read back rather than reconstruct: the op carries the complete check-in,
    // and the reducer is the authority on what that now is.
    const updated = getState().checkins.byId[id];
    if (updated !== undefined) {
      enqueue(dispatch, 'update', id, updated, now, before);
    }
  };

export const deleteCheckIn =
  (id: string, now: number = Date.now()): Thunk =>
  (dispatch, getState) => {
    const before = getState().checkins.byId[id] ?? null;
    dispatch(checkInDeleted(id));
    enqueue(dispatch, 'delete', id, null, now, before);
  };

/**
 * Abandon a queued change and put local state back where it was.
 *
 * The old behaviour removed the op and stopped there, which left the device
 * holding a value the server would silently overwrite on some later refetch —
 * a create would vanish, an edit would revert, a deleted check-in would
 * reappear, all with no warning and at an unpredictable moment. Reverting here
 * makes the consequence immediate and visible, which is the only honest way to
 * present a destructive action.
 */
export const discardOp =
  (opId: string): Thunk =>
  (dispatch, getState) => {
    const op = getState().sync.ops.find(entry => entry.opId === opId);
    if (op === undefined) {
      return;
    }

    /**
     * `?? null` rather than `=== null`, and deliberately so. The type says this
     * cannot be undefined, but a stored op from a build that predates `before`
     * has no such key at runtime — and treating that as "there is something to
     * restore" dereferences it. `normalizePendingOp` closes that on load; this
     * makes the reader safe on its own terms too.
     */
    const before = op.before ?? null;

    if (before === null) {
      // Nothing to go back to: the server never had this check-in.
      dispatch(checkInDeleted(op.entityId));
    } else {
      dispatch(checkInRestored(before));
    }

    dispatch(opDiscarded(opId));
  };
