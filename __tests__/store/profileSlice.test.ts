import {
  initialProfileState,
  profileCompleted,
  profileEdited,
  profileHydrated,
  profileReset,
  profileSynced,
  profileSyncFailed,
  profileSyncRetryRequested,
  profileDiscarded,
  profileReducer,
  type ProfileState,
} from '@/store/profile/profileSlice';
import {
  baselineSaved,
  goalsSaved,
  initialOnboardingState,
  nameSaved,
  onboardingReducer,
  stepEntered,
} from '@/store/onboarding/onboardingSlice';

/** What `GET /profile` would give us, in domain shape. */
const SERVER_PROFILE = {
  name: 'Server Name',
  baselineWeightKg: 70,
  heightCm: 170,
  stepGoal: null,
  waterGoalMl: null,
  sleepGoalMinutes: null,
  targetWeightKg: null,
};

const completed = profileCompleted({
  name: 'Demo',
  baselineWeightKg: 76.5,
  heightCm: 175,
  stepGoal: 10_000,
  waterGoalMl: 2500,
  sleepGoalMinutes: 480,
  targetWeightKg: 70,
  baselineSetAt: 1_700_000_000_000,
});

const reduce = (
  state: ProfileState,
  ...actions: Parameters<typeof profileReducer>[1][]
) => actions.reduce(profileReducer, state);

describe('profileCompleted', () => {
  it('opens the dashboard and queues the profile for the server', () => {
    const state = profileReducer(initialProfileState, completed);
    expect(state.isComplete).toBe(true);
    // Onboarding must not depend on a network (§3.4), so it is written
    // locally and pushed later.
    expect(state.pendingSync).toBe(true);
  });

  it('clears the onboarding draft it was copied from', () => {
    // The draft is scratch space. Leaving it behind puts a second, stale copy
    // of the name, weight, height and goals on disk, shadowing the real one.
    const draft = [
      nameSaved('Demo'),
      baselineSaved({ weightKg: 76.5, heightCm: 175 }),
      goalsSaved({
        stepGoal: 10_000,
        waterGoalMl: 2500,
        sleepGoalMinutes: 480,
        targetWeightKg: 70,
      }),
      stepEntered(4),
    ].reduce(onboardingReducer, initialOnboardingState);

    expect(draft.name).toBe('Demo');

    expect(onboardingReducer(draft, completed)).toEqual(initialOnboardingState);
  });
});

describe('profileEdited', () => {
  it('applies one field without touching the rest', () => {
    const state = reduce(
      initialProfileState,
      completed,
      profileSynced(),
      profileEdited({ heightCm: 180 }),
    );

    expect(state.heightCm).toBe(180);
    expect(state.baselineWeightKg).toBe(76.5);
    expect(state.stepGoal).toBe(10_000);
    expect(state.pendingSync).toBe(true);
  });

  it('clears a field with null, which is different from leaving it out', () => {
    const state = reduce(
      initialProfileState,
      completed,
      profileEdited({ targetWeightKg: null }),
    );
    expect(state.targetWeightKg).toBeNull();
  });

  it('ignores undefined rather than blanking a real value', () => {
    // The server's PUT is a full replace, so a half-formed profile here
    // becomes a half-erased profile there.
    const state = reduce(
      initialProfileState,
      completed,
      profileEdited({ stepGoal: undefined }),
    );
    expect(state.stepGoal).toBe(10_000);
  });

  it('leaves the baseline date alone when the weight is corrected', () => {
    // Fixing a typo is not re-baselining; the chart's first point stays where
    // the user actually started.
    const state = reduce(
      initialProfileState,
      completed,
      profileEdited({ baselineWeightKg: 77 }),
    );
    expect(state.baselineSetAt).toBe(1_700_000_000_000);
  });
});

describe('profileHydrated', () => {
  const fromServer = profileHydrated({
    name: 'Server Name',
    baselineWeightKg: 80,
    heightCm: 170,
    stepGoal: 5_000,
    waterGoalMl: 2000,
    sleepGoalMinutes: 480,
    targetWeightKg: 75,
  });

  it('fills in a fresh device and marks the account set up', () => {
    const state = profileReducer(initialProfileState, fromServer);
    expect(state.baselineWeightKg).toBe(80);
    expect(state.isComplete).toBe(true);
    expect(state.pendingSync).toBe(false);
  });

  it('never overwrites a local edit that has not been pushed', () => {
    // Otherwise a change made offline would visibly revert the next time the
    // app talked to the server.
    const state = reduce(
      initialProfileState,
      completed,
      profileSynced(),
      profileEdited({ heightCm: 180 }),
      fromServer,
    );

    expect(state.heightCm).toBe(180);
    expect(state.baselineWeightKg).toBe(76.5);
    expect(state.pendingSync).toBe(true);
  });

  it('keeps baselineSetAt, which the server has no field for', () => {
    const state = reduce(initialProfileState, completed, profileSynced(), fromServer);
    expect(state.baselineSetAt).toBe(1_700_000_000_000);
  });
});

describe('profileSynced / profileReset', () => {
  it('clears the dirty flag once the server has it', () => {
    const state = reduce(initialProfileState, completed, profileSynced());
    expect(state.pendingSync).toBe(false);
  });

  it('wipes everything for a different account', () => {
    const state = reduce(initialProfileState, completed, profileReset());
    expect(state).toEqual(initialProfileState);
  });
});

/**
 * The profile has a dirty flag instead of an outbox, which is right — the
 * server's PUT is a full replace, so five pending edits and one are the same
 * request. What it lacked was a way to *stop*: a rejected payload was retried
 * on every mount, foreground and reconnect, forever, with nothing on screen.
 */
describe('profile sync lifecycle', () => {
  const dirty = (): ProfileState =>
    profileReducer(initialProfileState, profileEdited({ name: 'Ada' }));

  it('marks an edit as pending and unfailed', () => {
    const state = dirty();
    expect(state.pendingSync).toBe(true);
    expect(state.syncFailed).toBe(false);
    expect(state.lastError).toBeNull();
  });

  it('clears everything on a successful push', () => {
    const state = profileReducer(dirty(), profileSynced());
    expect(state.pendingSync).toBe(false);
    expect(state.syncFailed).toBe(false);
    expect(state.lastError).toBeNull();
  });

  it('keeps a permanent failure pending AND flagged', () => {
    const state = profileReducer(dirty(), profileSyncFailed('Some details need fixing.'));
    // Still unsynced work — this is what logout has to warn about.
    expect(state.pendingSync).toBe(true);
    expect(state.syncFailed).toBe(true);
    expect(state.lastError).toBe('Some details need fixing.');
    // And the edit itself is untouched.
    expect(state.name).toBe('Ada');
  });

  it('re-arms on Retry without touching the values', () => {
    const failed = profileReducer(dirty(), profileSyncFailed('nope'));
    const retried = profileReducer(failed, profileSyncRetryRequested());

    expect(retried.syncFailed).toBe(false);
    expect(retried.lastError).toBeNull();
    // Still pending, so the engine picks it up again.
    expect(retried.pendingSync).toBe(true);
    expect(retried.name).toBe('Ada');
  });

  it('treats a fresh edit as new work rather than the rejected one', () => {
    const failed = profileReducer(dirty(), profileSyncFailed('nope'));
    const edited = profileReducer(failed, profileEdited({ name: 'Grace' }));

    expect(edited.syncFailed).toBe(false);
    expect(edited.pendingSync).toBe(true);
  });

  /**
   * Discard has to leave the local profile equal to the server's version.
   * Clearing the flags alone would strand the rejected value on screen,
   * indistinguishable from an accepted one — so the caller hydrates straight
   * after, and the order below is what makes that land.
   */
  it('lets the server copy through once the flags are cleared', () => {
    const failed = profileReducer(dirty(), profileSyncFailed('nope'));
    expect(failed.name).toBe('Ada');

    // Hydration alone is refused while the edit is still pending...
    const blocked = profileReducer(failed, profileHydrated(SERVER_PROFILE));
    expect(blocked.name).toBe('Ada');

    // ...so discard drops the flags first, then the server copy applies.
    const discarded = profileReducer(failed, profileDiscarded());
    expect(discarded.pendingSync).toBe(false);
    expect(discarded.syncFailed).toBe(false);

    const restored = profileReducer(discarded, profileHydrated(SERVER_PROFILE));
    // The rejected value is gone, which is the whole point of Discard.
    expect(restored.name).toBe('Server Name');
    expect(restored.baselineWeightKg).toBe(70);
    expect(restored.pendingSync).toBe(false);
    expect(restored.syncFailed).toBe(false);
  });
});

/**
 * The logout guard counts unsynced work. A permanently failed profile edit is
 * unsynced work — reading only `pendingSync` would let it be discarded with
 * no warning at all.
 */
describe('unsynced-work accounting', () => {
  const unsyncedCount = (p: ProfileState, ops = 0, failedOps = 0) =>
    ops + failedOps + (p.pendingSync || p.syncFailed ? 1 : 0);

  it('counts a clean profile as nothing', () => {
    expect(unsyncedCount(initialProfileState)).toBe(0);
  });

  it('counts a pending profile edit', () => {
    const p = profileReducer(initialProfileState, profileEdited({ name: 'Ada' }));
    expect(unsyncedCount(p)).toBe(1);
  });

  it('counts a permanently failed profile edit', () => {
    const p = profileReducer(
      profileReducer(initialProfileState, profileEdited({ name: 'Ada' })),
      profileSyncFailed('nope'),
    );
    expect(unsyncedCount(p)).toBe(1);
    // Even if the pending flag were ever cleared independently, the failure
    // alone must still block a silent logout.
    expect(unsyncedCount({ ...p, pendingSync: false })).toBe(1);
  });
});
