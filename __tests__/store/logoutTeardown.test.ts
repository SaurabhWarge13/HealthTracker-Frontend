/**
 * Logout is the account boundary, and this is the test that says so.
 *
 * The bug these cover was demonstrated on a device: user B signed in and
 * their dashboard rendered twelve of user A's check-ins. Two separate holes
 * led there — teardown that only cleared two slices, and an expiry path that
 * destroyed the one field the "is this a different person?" check reads.
 */
// Importing the barrel is what injects the feature endpoints into `baseApi`;
// without it `getProfile` does not exist to seed a cache entry against.
import '@/services/api';
import { baseApi } from '@/services/api/baseApi';
import {
  loggedOut,
  sessionExpired,
  sessionStarted,
} from '@/store/auth/authSlice';
import { checkInsReplaced } from '@/store/checkins/checkinsSlice';
import { stepEntered } from '@/store/onboarding/onboardingSlice';
import { profileCompleted } from '@/store/profile/profileSlice';
import { reminderEnabledChanged } from '@/store/settings/settingsSlice';
import { createAppStore } from '@/store/store';
import { opEnqueued, serverIdsRecorded } from '@/store/sync/syncSlice';
import { makePendingOp } from '@/domain/sync';
import type { CheckIn } from '@/domain/checkins/types';

const checkIn = (id: string): CheckIn => ({
  id,
  createdAt: 1_700_000_000_000,
  weightKg: 72,
  heightCm: null,
  steps: null,
  sleepMinutes: null,
  waterMl: null,
  mood: null,
  notes: '',
  sources: {},
});

/**
 * Tracked so it can be torn down: a seeded cache entry leaves RTK Query's
 * `keepUnusedDataFor` timer running well past the end of the test, and Jest
 * complains that the environment was dismantled underneath it.
 */
let activeStore: ReturnType<typeof createAppStore> | null = null;

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  activeStore?.dispatch(baseApi.util.resetApiState());
  activeStore = null;
  jest.clearAllTimers();
  jest.useRealTimers();
});

/** A signed-in account with something in every account-scoped slice. */
const populatedStore = () => {
  const store = createAppStore();
  activeStore = store;
  store.dispatch(
    sessionStarted({ userId: 'A', email: 'a@example.com', accessToken: 't' }),
  );
  store.dispatch(
    checkInsReplaced({ entries: [checkIn('local_1')], at: 1_000 }),
  );
  store.dispatch(serverIdsRecorded({ local_1: 'srv_1' }));
  store.dispatch(
    opEnqueued(makePendingOp('op_1', 'create', 'local_1', checkIn('local_1'), 1)),
  );
  store.dispatch(
    profileCompleted({
      name: 'A',
      baselineWeightKg: 80,
      heightCm: 180,
      stepGoal: null,
      waterGoalMl: null,
      sleepGoalMinutes: null,
      targetWeightKg: null,
      baselineSetAt: 1_000,
    }),
  );
  store.dispatch(stepEntered(2));
  store.dispatch(reminderEnabledChanged(true));
  return store;
};

describe('loggedOut tears down every account-scoped slice', () => {
  it('leaves nothing of the account behind', () => {
    const store = populatedStore();

    // Guard the guard: the fixture has to actually populate things, or this
    // test would pass against a store that was empty all along.
    const before = store.getState();
    expect(before.checkins.allIds).toHaveLength(1);
    expect(before.sync.ops).toHaveLength(1);
    expect(before.sync.serverIds).not.toEqual({});
    expect(before.profile.baselineWeightKg).toBe(80);
    expect(before.onboarding.step).toBe(2);
    expect(before.settings.reminderEnabled).toBe(true);

    store.dispatch(loggedOut());
    const after = store.getState();

    expect(after.checkins.allIds).toEqual([]);
    expect(after.checkins.byId).toEqual({});
    expect(after.sync.ops).toEqual([]);
    expect(after.sync.serverIds).toEqual({});
    expect(after.profile.baselineWeightKg).toBeNull();
    expect(after.profile.name).toBe('');
    expect(after.onboarding.step).toBe(1);
    expect(after.settings.reminderEnabled).toBe(false);
    expect(after.healthConnect.today).toEqual(
      store.getState().healthConnect.today,
    );
    expect(after.auth.hasSession).toBe(false);
    expect(after.auth.userId).toBeNull();
  });

  it('clears the RTK Query cache so the next account cannot read it', () => {
    const store = populatedStore();
    // Seed the cache the way a real query would.
    store.dispatch(
      baseApi.util.upsertQueryData('getProfile' as never, undefined as never, {
        name: 'A',
      } as never),
    );
    expect(Object.keys(store.getState().api.queries).length).toBeGreaterThan(0);

    // The one thing that cannot reset itself, so SettingsScreen dispatches it
    // explicitly alongside loggedOut.
    store.dispatch(baseApi.util.resetApiState());
    store.dispatch(loggedOut());

    expect(store.getState().api.queries).toEqual({});
  });
});

describe('session expiry keeps the work but never hands it to someone else', () => {
  it('preserves check-ins and the outbox for the same user to recover', () => {
    const store = populatedStore();
    store.dispatch(sessionExpired('Your session ended'));

    const state = store.getState();
    expect(state.auth.hasSession).toBe(false);
    // The user did not ask to throw anything away (§4.11).
    expect(state.checkins.allIds).toHaveLength(1);
    expect(state.sync.ops).toHaveLength(1);
    // And we still know whose it is — the field the sign-in guard reads.
    expect(state.auth.userId).toBe('A');
  });

  it('identifies a different user after expiry, which is what closes the leak', () => {
    const store = populatedStore();
    store.dispatch(sessionExpired('Your session ended'));

    /**
     * The exact comparison `useSignIn` makes. Before the fix `previousUserId`
     * was null here, so this evaluated false and user B kept user A's data —
     * the leak reproduced on-device.
     */
    const previousUserId = store.getState().auth.userId;
    const isDifferentUser = previousUserId !== null && previousUserId !== 'B';
    expect(isDifferentUser).toBe(true);

    // Which sends the sign-in path down the clearing branch.
    store.dispatch(loggedOut());
    expect(store.getState().checkins.allIds).toEqual([]);
    expect(store.getState().sync.ops).toEqual([]);
  });

  it('recognises the same user coming back, so their work survives', () => {
    const store = populatedStore();
    store.dispatch(sessionExpired('Your session ended'));

    const previousUserId = store.getState().auth.userId;
    expect(previousUserId !== null && previousUserId !== 'A').toBe(false);

    store.dispatch(
      sessionStarted({ userId: 'A', email: 'a@example.com', accessToken: 't2' }),
    );
    expect(store.getState().checkins.allIds).toHaveLength(1);
    expect(store.getState().sync.ops).toHaveLength(1);
  });
});
