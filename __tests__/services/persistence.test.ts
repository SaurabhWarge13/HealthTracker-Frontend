/**
 * Persistence is the whole point of this step, and react-native-mmkv swaps in
 * a working in-memory store under Jest, so these exercise the real code path
 * rather than a stub.
 */
import { AppState, type AppStateStatus } from 'react-native';
import {
  clearPersistedState,
  loadPersistedState,
  startPersisting,
  storage,
} from '@/services/storage';
import { sessionStarted, loggedOut } from '@/store/auth/authSlice';
import { checkInsReplaced } from '@/store/checkins/checkinsSlice';
import {
  notificationPermissionRead,
  reminderEnabledChanged,
} from '@/store/settings/settingsSlice';
import { createAppStore } from '@/store/store';
import type { CheckIn } from '@/domain/checkins/types';

const PERSIST_KEY = 'state:v1';
const WRITE_DELAY_MS = 250;

const signIn = sessionStarted({
  userId: 'u1',
  email: 'demo@healthtracker.app',
  accessToken: 'access-token-value',
});

const checkIn: CheckIn = {
  id: 'local_1',
  createdAt: 1_700_000_000_000,
  weightKg: 72,
  heightCm: 175,
  steps: null,
  sleepMinutes: null,
  waterMl: null,
  mood: null,
  notes: '',
  sources: {},
};

const readRaw = (): unknown =>
  JSON.parse(storage.getString(PERSIST_KEY) ?? 'null');

beforeEach(() => {
  jest.useFakeTimers();
  clearPersistedState();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('loadPersistedState', () => {
  it('returns undefined when nothing has been written', () => {
    expect(loadPersistedState()).toBeUndefined();
  });

  it('starts clean rather than crashing on a corrupt blob', () => {
    storage.set(PERSIST_KEY, 'not json {{{');
    expect(loadPersistedState()).toBeUndefined();
    // And it clears the bad value so it cannot fail again on every launch.
    expect(storage.getString(PERSIST_KEY)).toBeUndefined();
  });

  it('drops state written by an older schema', () => {
    storage.set(PERSIST_KEY, JSON.stringify({ version: 0, state: { profile: {} } }));
    expect(loadPersistedState()).toBeUndefined();
  });

  /**
   * The gap that shipped once already.
   *
   * `PendingOp` gained `before` and `lastErrorKind` after this schema version
   * was cut, and Redux replaces a preloaded slice rather than merging it with
   * initial state — so ops queued by the previous build arrive without those
   * keys. `before` is read as `=== null`, `undefined` fails that check, and the
   * code behind it dereferences the value. The result was a crash on the
   * Discard button, reachable by anyone who had a failed op waiting.
   */
  it('fills in fields an op queued by an older build never had', () => {
    storage.set(
      PERSIST_KEY,
      JSON.stringify({
        version: 1,
        state: {
          auth: { hasSession: true },
          sync: {
            ops: [
              {
                opId: 'op_old',
                kind: 'update',
                entityId: 'srv_1',
                payload: checkIn,
                createdAt: 1,
                attempts: 6,
                nextAttemptAt: 1,
                failed: true,
                lastError: 'Some details need fixing.',
                // no `before`, no `lastErrorKind` — this build predates them
              },
            ],
            serverIds: {},
            inFlightOpId: null,
            lastSyncedAt: null,
          },
        },
      }),
    );

    const op = loadPersistedState()?.sync?.ops[0];

    expect(op).toBeDefined();
    expect(op?.before).toBeNull();
    expect(op?.lastErrorKind).toBeNull();
    // The distinction that matters — `undefined` passes neither of the above.
    expect(op?.before).not.toBeUndefined();
  });

  /**
   * Why `settings` was added without bumping SCHEMA_VERSION.
   *
   * A version bump drops the whole blob on mismatch — including `sync.ops`,
   * the check-ins the server has not heard about yet (§4.11). Paying that for
   * an additive slice would be the expensive way to add a boolean, and it is
   * unnecessary: `withSliceDefaults` skips a key the stored state does not
   * have, and `combineReducers` then supplies the slice's initial state.
   *
   * Asserted rather than argued, because the cost of being wrong is a user's
   * unsynced work.
   */
  it('loads a blob written before the settings slice existed', () => {
    storage.set(
      PERSIST_KEY,
      JSON.stringify({
        version: 1,
        state: {
          auth: { hasSession: true },
          sync: { ops: [], serverIds: {}, inFlightOpId: null, lastSyncedAt: null },
          // no `settings` at all — this build predates it
        },
      }),
    );

    const loaded = loadPersistedState();
    expect(loaded).toBeDefined();
    expect(loaded?.settings).toBeUndefined();

    // The store fills the gap, and the reminder is off rather than undefined.
    const store = createAppStore(loaded);
    expect(store.getState().settings.reminderEnabled).toBe(false);
    expect(store.getState().settings.notificationsPermitted).toBe(false);
  });

  /**
   * The mapping is what a queued delete resolves its server id through, and it
   * outlives the op that recorded it. A restart must not be the thing that
   * separates the two — the op would go out addressing a local id.
   */
  it('restores the mappings a queued op still depends on', () => {
    storage.set(
      PERSIST_KEY,
      JSON.stringify({
        version: 1,
        state: {
          auth: { hasSession: true },
          sync: {
            ops: [
              {
                opId: 'op_1',
                kind: 'delete',
                entityId: 'local_1',
                payload: null,
                createdAt: 1,
                attempts: 0,
                nextAttemptAt: 1,
                failed: false,
                lastError: null,
                lastErrorKind: null,
                before: null,
              },
            ],
            serverIds: { local_1: 'srv_9' },
            // `snapshot` always writes null here — nothing can still be in
            // flight once the process that owned the request is gone.
            inFlightOpId: null,
            lastSyncedAt: null,
          },
        },
      }),
    );

    const store = createAppStore(loadPersistedState());

    expect(store.getState().sync.serverIds).toEqual({ local_1: 'srv_9' });
    expect(store.getState().sync.ops).toHaveLength(1);
    expect(store.getState().sync.ops[0].entityId).toBe('local_1');
  });

  it('survives a blob whose queue is missing or malformed', () => {
    storage.set(
      PERSIST_KEY,
      JSON.stringify({
        version: 1,
        state: { auth: { hasSession: true }, sync: { serverIds: {} } },
      }),
    );
    // Losing the whole session because one key is the wrong shape would cost
    // the user far more than the queue itself.
    expect(loadPersistedState()?.sync?.ops).toEqual([]);
    expect(loadPersistedState()?.auth?.hasSession).toBe(true);
  });

  /**
   * The other half of the same problem, one level up.
   *
   * Redux replaces a preloaded slice rather than merging it, so any field added
   * to a slice after this schema version was cut arrives as `undefined` for
   * existing users. `null` is what "not set" means everywhere in this app, and
   * `undefined` fails every `=== null` check written against it.
   */
  it('fills in slice fields written before those fields existed', () => {
    storage.set(
      PERSIST_KEY,
      JSON.stringify({
        version: 1,
        state: {
          auth: { hasSession: true },
          // A profile from a build that had no goals at all.
          profile: { name: 'Sam', baselineWeightKg: 76.5 },
        },
      }),
    );

    const profile = loadPersistedState()?.profile;

    expect(profile?.name).toBe('Sam');
    expect(profile?.baselineWeightKg).toBe(76.5);
    // Absent keys come back as their initial value, not undefined.
    expect(profile?.stepGoal).toBeNull();
    expect(profile?.waterGoalMl).toBeNull();
    expect(profile?.pendingSync).toBe(false);
    expect(profile?.isComplete).toBe(false);
  });

  it('never overwrites a value the user actually has', () => {
    // The merge is additive only. A goal deliberately cleared back to null, or
    // a name set to empty, must survive — resurrecting a default here would
    // silently undo an edit.
    storage.set(
      PERSIST_KEY,
      JSON.stringify({
        version: 1,
        state: {
          auth: { hasSession: true },
          profile: {
            name: '',
            baselineWeightKg: 70,
            stepGoal: null,
            waterGoalMl: 2500,
            isComplete: true,
            pendingSync: true,
          },
        },
      }),
    );

    const profile = loadPersistedState()?.profile;

    expect(profile?.stepGoal).toBeNull();
    expect(profile?.waterGoalMl).toBe(2500);
    expect(profile?.isComplete).toBe(true);
    expect(profile?.pendingSync).toBe(true);
  });

  it('round-trips a real session', () => {
    const store = createAppStore();
    startPersisting(store);
    store.dispatch(signIn);
    store.dispatch(checkInsReplaced({ entries: [checkIn], at: 1 }));
    jest.advanceTimersByTime(WRITE_DELAY_MS);

    const restored = loadPersistedState();
    expect(restored?.auth?.hasSession).toBe(true);
    expect(restored?.checkins?.byId.local_1?.weightKg).toBe(72);
  });
});

describe('startPersisting', () => {
  it('never writes the access token — it is memory-only by contract', () => {
    const store = createAppStore();
    startPersisting(store);
    store.dispatch(signIn);
    jest.advanceTimersByTime(WRITE_DELAY_MS);

    expect(storage.getString(PERSIST_KEY)).not.toContain('access-token-value');
    expect(loadPersistedState()?.auth?.accessToken).toBeNull();
  });

  it('persists only the durable slices', () => {
    const store = createAppStore();
    startPersisting(store);
    store.dispatch(signIn);
    jest.advanceTimersByTime(WRITE_DELAY_MS);

    const raw = readRaw() as { state: Record<string, unknown> };
    expect(Object.keys(raw.state).sort()).toEqual([
      'auth',
      'checkins',
      'onboarding',
      'profile',
      'settings',
      'sync',
    ]);
    // healthConnect is device truth, re-read on resume; connectivity from
    // disk would be a lie; api is a request cache.
    expect(raw.state.healthConnect).toBeUndefined();
    expect(raw.state.connectivity).toBeUndefined();
    expect(raw.state.api).toBeUndefined();
  });

  /**
   * Four separate wiring points have to line up for a setting to survive:
   * the PersistedState type, `withSliceDefaults`, `snapshot`, and the
   * reference comparison that decides a write is even needed. Leave out that
   * last one and a settings-only dispatch never schedules a write — nothing
   * else in this suite would notice.
   */
  it('remembers the reminder the user turned on', () => {
    const store = createAppStore();
    startPersisting(store);
    store.dispatch(signIn);
    store.dispatch(reminderEnabledChanged(true));
    jest.advanceTimersByTime(WRITE_DELAY_MS);

    expect(loadPersistedState()?.settings?.reminderEnabled).toBe(true);
  });

  it('never writes the notification permission — the device owns that', () => {
    // Same contract as the access token above. A remembered `true` would
    // schedule a reminder against a permission that may have been revoked
    // while the app was closed, and nothing would say so.
    const store = createAppStore();
    startPersisting(store);
    store.dispatch(signIn);
    store.dispatch(reminderEnabledChanged(true));
    store.dispatch(notificationPermissionRead(true));
    jest.advanceTimersByTime(WRITE_DELAY_MS);

    expect(loadPersistedState()?.settings?.notificationsPermitted).toBe(false);
  });

  it('wipes the blob on logout, so the next user never sees the last one', () => {
    const store = createAppStore();
    startPersisting(store);
    store.dispatch(signIn);
    store.dispatch(checkInsReplaced({ entries: [checkIn], at: 1 }));
    jest.advanceTimersByTime(WRITE_DELAY_MS);
    expect(loadPersistedState()).toBeDefined();

    store.dispatch(loggedOut());
    jest.advanceTimersByTime(WRITE_DELAY_MS);
    expect(loadPersistedState()).toBeUndefined();
  });

  it('writes nothing before a session exists', () => {
    const store = createAppStore();
    startPersisting(store);
    store.dispatch(checkInsReplaced({ entries: [checkIn], at: 1 }));
    jest.advanceTimersByTime(WRITE_DELAY_MS);

    expect(loadPersistedState()).toBeUndefined();
  });

  it('batches a burst of dispatches into one write', () => {
    const store = createAppStore();
    startPersisting(store);
    const setSpy = jest.spyOn(storage, 'set');

    store.dispatch(signIn);
    store.dispatch(checkInsReplaced({ entries: [checkIn], at: 1 }));
    store.dispatch(checkInsReplaced({ entries: [checkIn, { ...checkIn, id: 'local_2' }], at: 2 }));
    jest.advanceTimersByTime(WRITE_DELAY_MS);

    expect(setSpy).toHaveBeenCalledTimes(1);
    // And the single write holds the newest state, not the first.
    expect(loadPersistedState()?.checkins?.allIds).toHaveLength(2);
    setSpy.mockRestore();
  });

  it('stops writing once unsubscribed', () => {
    const store = createAppStore();
    const unsubscribe = startPersisting(store);
    unsubscribe();

    store.dispatch(signIn);
    jest.advanceTimersByTime(WRITE_DELAY_MS);
    expect(loadPersistedState()).toBeUndefined();
  });

  it('flushes on backgrounding, so a change made just before a swipe survives', () => {
    let onAppStateChange: ((status: AppStateStatus) => void) | undefined;
    const spy = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type, handler) => {
        onAppStateChange = handler as (status: AppStateStatus) => void;
        return { remove: () => {} } as ReturnType<typeof AppState.addEventListener>;
      });

    const store = createAppStore();
    startPersisting(store);
    store.dispatch(signIn);
    store.dispatch(checkInsReplaced({ entries: [checkIn], at: 1 }));

    // Swiped away before the batch delay elapsed.
    onAppStateChange?.('background');
    expect(loadPersistedState()?.checkins?.allIds).toEqual(['local_1']);

    spy.mockRestore();
  });
});
