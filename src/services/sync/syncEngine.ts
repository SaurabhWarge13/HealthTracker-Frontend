import {
  canRetry,
  nextDelayMs,
  reconcileCheckIns,
  type PendingOp,
} from '@/domain/sync';
import { isRetryable, normalizeError, userMessage } from '@/domain/api/errors';
import { checkInsApi } from '@/services/api/checkInsApi';
import { profileApi } from '@/services/api/profileApi';
import { toCheckIn, type CheckInDto } from '@/services/api/dto';
import type { CheckIn } from '@/domain/checkins/types';
import {
  checkInsFetchFailed,
  checkInsFetchStarted,
  checkInsReplaced,
} from '@/store/checkins/checkinsSlice';
import { profileSyncFailed, profileSynced } from '@/store/profile/profileSlice';
import { selectNextDueOp } from '@/store/sync/syncSelectors';
import {
  inFlightCleared,
  opFailed,
  opRetryScheduled,
  opStarted,
  opSucceeded,
} from '@/store/sync/syncSlice';
import type { AppStore } from '@/store/store';

type SendResult = { ok: true } | { ok: false; error: unknown };

async function upsert(store: AppStore, payload: CheckIn): Promise<SendResult> {
  const request = store.dispatch(
    checkInsApi.endpoints.createCheckIn.initiate(payload),
  );
  try {
    const result = await request;
    return 'error' in result ? { ok: false, error: result.error } : { ok: true };
  } finally {
    request.reset();
  }
}

async function send(store: AppStore, op: PendingOp): Promise<SendResult> {
  const { dispatch } = store;

  if (op.kind === 'create') {
    if (op.payload === null) {
      return { ok: false, error: { status: 400 } };
    }
    return upsert(store, op.payload);
  }

  // The entity id is the server's id: the client minted it and the server
  // stored it as the primary key. Nothing to resolve.
  if (op.kind === 'delete') {
    const request = dispatch(
      checkInsApi.endpoints.deleteCheckIn.initiate(op.entityId),
    );
    try {
      const result = await request;
      if (!('error' in result)) {
        return { ok: true };
      }
      if (normalizeError(result.error).kind === 'notFound') {
        return { ok: true };
      }
      return { ok: false, error: result.error };
    } finally {
      request.reset();
    }
  }

  if (op.payload === null) {
    return { ok: true };
  }

  const request = dispatch(
    checkInsApi.endpoints.updateCheckIn.initiate({
      id: op.entityId,
      checkIn: op.payload,
    }),
  );
  let updateError: unknown;
  try {
    const result = await request;
    if (!('error' in result)) {
      return { ok: true };
    }
    updateError = result.error;
  } finally {
    request.reset();
  }

  // The row is not there — it was never pushed, or the server lost it. POST
  // recreates it under the same id, so the client's view stays correct.
  if (normalizeError(updateError).kind === 'notFound') {
    return upsert(store, op.payload);
  }
  return { ok: false, error: updateError };
}

const sessionFence = (store: AppStore) => {
  const epoch = store.getState().auth.sessionEpoch;
  return () => store.getState().auth.sessionEpoch !== epoch;
};

async function runOp(store: AppStore, op: PendingOp): Promise<boolean> {
  const stale = sessionFence(store);
  store.dispatch(opStarted(op.opId));
  const result = await send(store, op);

  if (stale()) {
    return false;
  }

  if (result.ok) {
    store.dispatch(opSucceeded({ opId: op.opId, at: Date.now() }));
    return true;
  }

  const error = normalizeError(result.error, {
    isOnline: store.getState().connectivity.isOnline,
  });

  if (isRetryable(error) && canRetry(op.attempts + 1)) {
    store.dispatch(
      opRetryScheduled({
        opId: op.opId,
        nextAttemptAt: Date.now() + nextDelayMs(op.attempts),
        message: userMessage(error),
        kind: error.kind,
      }),
    );
    return false;
  }

  store.dispatch(
    opFailed({ opId: op.opId, message: userMessage(error), kind: error.kind }),
  );
  return true;
}

let drainInFlight: Promise<void> | null = null;

export function drainSyncQueue(store: AppStore): Promise<void> {
  drainInFlight ??= runDrain(store).finally(() => {
    drainInFlight = null;
  });
  return drainInFlight;
}

async function runDrain(store: AppStore): Promise<void> {
  try {
    for (;;) {
      const state = store.getState();
      if (!state.auth.hasSession || !state.connectivity.isOnline) {
        return;
      }
      const op = selectNextDueOp(Date.now())(state);
      if (op === null) {
        return;
      }
      const shouldContinue = await runOp(store, op);
      if (!shouldContinue) {
        return;
      }
    }
  } finally {
    if (
      store.getState().auth.hasSession &&
      store.getState().sync.inFlightOpId !== null
    ) {
      store.dispatch(inFlightCleared());
    }
  }
}

export async function awaitSyncIdle(): Promise<void> {
  await Promise.allSettled([drainInFlight, pullInFlight]);
}

let pullInFlight: Promise<void> | null = null;

export function pullCheckIns(store: AppStore): Promise<void> {
  pullInFlight ??= runPull(store).finally(() => {
    pullInFlight = null;
  });
  return pullInFlight;
}

async function runPull(store: AppStore): Promise<void> {
  const { dispatch, getState } = store;
  if (!getState().auth.hasSession || !getState().connectivity.isOnline) {
    return;
  }
  const stale = sessionFence(store);

  const isFirstLoad = getState().checkins.allIds.length === 0;
  if (isFirstLoad) {
    dispatch(checkInsFetchStarted(Date.now()));
  }

  const request = dispatch(
    checkInsApi.endpoints.listCheckIns.initiate(undefined, { forceRefetch: true }),
  );
  let data: CheckInDto[] | undefined;
  let failed = false;
  try {
    const result = await request;
    failed = result.isError;
    data = result.data;
  } finally {
    request.unsubscribe();
  }

  if (stale()) {
    return;
  }

  if (failed || data === undefined) {
    dispatch(checkInsFetchFailed());
    return;
  }

  const server = data.map(toCheckIn);
  const state = getState();

  const entries = reconcileCheckIns({ server, ops: state.sync.ops });

  dispatch(checkInsReplaced({ entries, at: Date.now() }));
}

export async function pushProfile(store: AppStore): Promise<void> {
  const { dispatch, getState } = store;
  const state = getState();

  if (!state.auth.hasSession || !state.connectivity.isOnline) {
    return;
  }
  const profile = state.profile;
  if (!profile.pendingSync || profile.baselineWeightKg === null) {
    return;
  }
  if (profile.syncFailed) {
    return;
  }
  const stale = sessionFence(store);

  const request = dispatch(
    profileApi.endpoints.updateProfile.initiate({
      name: profile.name,
      baselineWeightKg: profile.baselineWeightKg,
      heightCm: profile.heightCm,
      stepGoal: profile.stepGoal,
      waterGoalMl: profile.waterGoalMl,
      sleepGoalMinutes: profile.sleepGoalMinutes,
      targetWeightKg: profile.targetWeightKg,
    }),
  );
  try {
    const result = await request;
    if (stale()) {
      return;
    }
    if (!('error' in result)) {
      dispatch(profileSynced());
      return;
    }

    const error = normalizeError(result.error, {
      isOnline: getState().connectivity.isOnline,
    });
    if (!isRetryable(error)) {
      dispatch(profileSyncFailed(userMessage(error)));
    }
  } finally {
    request.reset();
  }
}

export async function runSync(store: AppStore): Promise<void> {
  await pushProfile(store);
  await drainSyncQueue(store);
  await pullCheckIns(store);
}
