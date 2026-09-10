/**
 * Drains the outbox, sequentially: ops for one check-in depend on each other,
 * since a create has to land before the update that follows it can resolve a
 * server id. Nothing here throws at the caller.
 */
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
import { resolveServerId, selectNextDueOp } from '@/store/sync/syncSelectors';
import {
  inFlightCleared,
  opFailed,
  opRetryScheduled,
  opStarted,
  opSucceeded,
  serverIdsRecorded,
  staleServerIdsPruned,
} from '@/store/sync/syncSlice';
import type { AppStore } from '@/store/store';

type SendResult = { ok: true; serverId?: string } | { ok: false; error: unknown };

/** POST, which the server upserts on `clientId`. Safe to repeat. */
async function upsert(store: AppStore, payload: CheckIn): Promise<SendResult> {
  const request = store.dispatch(
    checkInsApi.endpoints.createCheckIn.initiate(payload),
  );
  try {
    const result = await request;
    return 'error' in result
      ? { ok: false, error: result.error }
      : { ok: true, serverId: result.data.id };
  } finally {
    // `initiate` outside a component leaves the entry subscribed; without
    // this the mutation cache grows for the life of the process.
    request.reset();
  }
}

async function send(store: AppStore, op: PendingOp): Promise<SendResult> {
  const { dispatch, getState } = store;
  const serverIds = getState().sync.serverIds;

  if (op.kind === 'create') {
    if (op.payload === null) {
      // Unreachable unless the queue is corrupt. Surfaced rather than dropped,
      // because it still represents something the user typed.
      return { ok: false, error: { status: 400 } };
    }
    return upsert(store, op.payload);
  }

  const serverId = resolveServerId(op.entityId, serverIds);

  if (op.kind === 'delete') {
    // Falls back to the client's own id: the server matches a delete on
    // either, which is what makes a check-in deletable after its create landed
    // but its response was lost.
    const request = dispatch(
      checkInsApi.endpoints.deleteCheckIn.initiate(serverId ?? op.entityId),
    );
    try {
      const result = await request;
      if (!('error' in result)) {
        return { ok: true };
      }
      // Already gone is the outcome the user asked for, not a failure to put
      // a decision card in front of them for.
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

  // An update for something this device has no server id for. Dropping it
  // discarded the user's edit while still reporting a successful sync, so send
  // the idempotent POST instead: it upserts on `clientId`, so it is correct
  // whether or not the original create ever landed.
  if (serverId === null) {
    return upsert(store, op.payload);
  }

  const request = dispatch(
    checkInsApi.endpoints.updateCheckIn.initiate({ serverId, checkIn: op.payload }),
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

  // No row under that id — stale mapping, or the row was removed out from
  // under us. The user still means for it to exist, so re-establish it; the
  // POST upserts on `clientId`, so it cannot double up.
  if (normalizeError(updateError).kind === 'notFound') {
    return upsert(store, op.payload);
  }
  return { ok: false, error: updateError };
}

/**
 * A fence against results from a session that has already ended.
 *
 * `auth.hasSession` cannot do this: user A logs out, user B signs in, and A's
 * request comes back to find `hasSession` true again — the check passes and
 * A's check-in is written into B's account. The epoch changes on every
 * transition, so a captured value identifies the session, not just presence.
 */
const sessionFence = (store: AppStore) => {
  const epoch = store.getState().auth.sessionEpoch;
  return () => store.getState().auth.sessionEpoch !== epoch;
};

/** True when the loop should keep going. */
async function runOp(store: AppStore, op: PendingOp): Promise<boolean> {
  const stale = sessionFence(store);
  store.dispatch(opStarted(op.opId));
  const result = await send(store, op);

  // The session ended while this was on the wire, and the queue it refers to
  // has been torn down. Dispatching now would resurrect it.
  if (stale()) {
    return false;
  }

  if (result.ok) {
    store.dispatch(
      opSucceeded({
        opId: op.opId,
        entityId: op.entityId,
        serverId: result.serverId,
        at: Date.now(),
        forget: op.kind === 'delete',
      }),
    );
    return true;
  }

  const error = normalizeError(result.error, {
    isOnline: store.getState().connectivity.isOnline,
  });

  // A validation error fails identically forever and would block everything
  // behind it, so only plausibly-recoverable failures get another attempt.
  if (isRetryable(error) && canRetry(op.attempts + 1)) {
    store.dispatch(
      opRetryScheduled({
        opId: op.opId,
        nextAttemptAt: Date.now() + nextDelayMs(op.attempts),
        message: userMessage(error),
        kind: error.kind,
      }),
    );
    // Whatever went wrong is likely to affect the next op too — stop rather
    // than burn through the queue's retry budget in one go.
    return false;
  }

  store.dispatch(
    opFailed({ opId: op.opId, message: userMessage(error), kind: error.kind }),
  );
  return true;
}

/**
 * One drain at a time across the whole app. A promise rather than a boolean so
 * a caller that needs the queue quiet — logout in particular — can await the
 * attempt already running instead of racing it.
 */
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
    // An op interrupted mid-request would otherwise be skipped by every
    // future drain, because it still looks in flight. Guarded by the session
    // check so a teardown's fresh state is not written back into.
    if (
      store.getState().auth.hasSession &&
      store.getState().sync.inFlightOpId !== null
    ) {
      store.dispatch(inFlightCleared());
    }
  }
}

/**
 * Resolves once nothing is on the wire. Exists for the destructive logout
 * path: wiping the account out from under a request that is about to come back
 * is how a torn-down queue gets repopulated. Bounded by the transport's own
 * `API_TIMEOUT_MS`, and `sessionFence` still catches late arrivals.
 */
export async function awaitSyncIdle(): Promise<void> {
  await Promise.allSettled([drainInFlight, pullInFlight]);
}

let pullInFlight: Promise<void> | null = null;

/**
 * Pulls the server's list and folds in anything still queued — applying the
 * response directly would overwrite every check-in created or edited offline.
 *
 * Single-flight and coalescing rather than skipping: `runSync` fires from four
 * triggers plus a timer, and without the latch two of them could each fetch
 * the list and dispatch competing snapshots.
 */
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

  // Only the first load shows a skeleton; flashing one over data the user is
  // already reading, on every foreground, is worse than a silent refresh.
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
    // `isError`, not `data === undefined`: RTK Query keeps the last successful
    // `data` when a later refetch fails, so after one good load a dead network
    // still hands back the previous list. Reading only `data` re-applied that
    // stale list as though it were current and never set the failure flag.
    failed = result.isError;
    data = result.data;
  } finally {
    request.unsubscribe();
  }

  if (stale()) {
    return;
  }

  if (failed || data === undefined) {
    // Local data is left untouched — it is the user's work and still on the
    // device. Recorded on every failure, not just the first load: the flag is
    // what lets the dashboard say "couldn't refresh" rather than presenting
    // stale data as current.
    dispatch(checkInsFetchFailed());
    return;
  }

  const server = data.map(toCheckIn);
  const state = getState();

  /**
   * Record what each entry is known as on the server, before reconciling —
   * `reconcileCheckIns` uses this map to fold a row back onto the local id it
   * is already known by, so recording it afterwards leaves the entry showing
   * twice until the next pull.
   *
   * Only rows this device created need an entry; `clientId` is how that
   * pairing is recovered when the POST landed but its response never arrived.
   * A server-born row would map to itself, which says nothing and grew the map
   * by one persisted key per row, so it is skipped.
   */
  const identities: Record<string, string> = {};
  for (const row of data) {
    const localId =
      typeof row.clientId === 'string' && row.clientId !== '' ? row.clientId : row.id;
    if (localId !== row.id && state.sync.serverIds[localId] === undefined) {
      identities[localId] = row.id;
    }
  }
  const serverIds =
    Object.keys(identities).length > 0
      ? { ...state.sync.serverIds, ...identities }
      : state.sync.serverIds;

  if (Object.keys(identities).length > 0) {
    dispatch(serverIdsRecorded(identities));
  }

  const entries = reconcileCheckIns({ server, ops: state.sync.ops, serverIds });

  dispatch(checkInsReplaced({ entries, at: Date.now() }));

  /**
   * Safe only because `GET /checkins` takes no page or filter arguments, so a
   * successful response is the whole truth about which rows exist. If
   * pagination is ever added to that endpoint this prune becomes unsound.
   *
   * A failed pull returns above without reaching this: absence from a response
   * that never came would otherwise read as deletion.
   */
  dispatch(staleServerIdsPruned({ keep: entries.map(entry => entry.id) }));
}

/**
 * Sends the profile when it has local edits. A single dirty flag rather than a
 * queue, because `PUT /profile` is a full replace.
 */
export async function pushProfile(store: AppStore): Promise<void> {
  const { dispatch, getState } = store;
  const state = getState();

  if (!state.auth.hasSession || !state.connectivity.isOnline) {
    return;
  }
  const profile = state.profile;
  if (!profile.pendingSync || profile.baselineWeightKg === null) {
    // Baseline weight is the server's one required field; without it there is
    // no valid profile to send yet.
    return;
  }
  // Already rejected for a reason another attempt cannot fix. Re-sending on
  // every mount, foreground and reconnect achieved nothing and was invisible;
  // the user resolves it from Settings instead.
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

    // A transport failure leaves the flag set and says nothing — the next
    // trigger tries again. A rejected payload will be rejected identically
    // forever, so it is recorded and the user is given the decision.
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

/** Push first, then pull, so the server has our changes before we read it. */
export async function runSync(store: AppStore): Promise<void> {
  await pushProfile(store);
  await drainSyncQueue(store);
  await pullCheckIns(store);
}
