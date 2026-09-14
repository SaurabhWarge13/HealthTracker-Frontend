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

export const createCheckIn =
  (draft: CheckInDraft, now: number = Date.now()): Thunk<string> =>
  dispatch => {
    const checkIn: CheckIn = { ...draft, id: createId(), createdAt: now };
    dispatch(checkInCreated(checkIn));
    enqueue(dispatch, 'create', checkIn.id, checkIn, now, null);
    return checkIn.id;
  };

export const updateCheckIn =
  (id: string, changes: Partial<CheckInDraft>, now: number = Date.now()): Thunk =>
  (dispatch, getState) => {
    const before = getState().checkins.byId[id] ?? null;

    dispatch(checkInUpdated({ id, changes }));
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

export const discardOp =
  (opId: string): Thunk =>
  (dispatch, getState) => {
    const op = getState().sync.ops.find(entry => entry.opId === opId);
    if (op === undefined) {
      return;
    }

    const before = op.before ?? null;

    if (before === null) {
      dispatch(checkInDeleted(op.entityId));
    } else {
      dispatch(checkInRestored(before));
    }

    dispatch(opDiscarded(opId));
  };
