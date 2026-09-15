import { applyAuthProfile } from '@/store/profile/profileCommands';
import { profileCompleted, profileReset } from '@/store/profile/profileSlice';
import { createAppStore } from '@/store/store';
import type { ProfileDto } from '@/services/api/dto';

const serverProfile: ProfileDto = {
  name: 'Sam',
  baselineWeight: 76.5,
  height: 175,
  stepGoal: 9000,
  waterGoal: 2500,
  sleepGoal: 480,
  targetWeight: 72,
  updatedAt: '2026-09-15T10:00:00.000Z',
};

/** What `profileCompleted` leaves behind: finished locally, not yet pushed. */
const completedOffline = () => {
  const store = createAppStore();
  store.dispatch(
    profileCompleted({
      name: 'Offline Sam',
      baselineWeightKg: 80,
      heightCm: 180,
      stepGoal: 12000,
      waterGoalMl: null,
      sleepGoalMinutes: null,
      targetWeightKg: 74,
      baselineSetAt: 1_000,
    }),
  );
  expect(store.getState().profile.pendingSync).toBe(true);
  return store;
};

describe('applyAuthProfile', () => {
  it('hydrates the profile the auth response carried', () => {
    const store = createAppStore();

    store.dispatch(applyAuthProfile(serverProfile));

    const profile = store.getState().profile;
    expect(profile.isComplete).toBe(true);
    expect(profile.name).toBe('Sam');
    expect(profile.baselineWeightKg).toBe(76.5);
    expect(profile.stepGoal).toBe(9000);
    expect(profile.pendingSync).toBe(false);
  });

  it('resets when the server has no profile and nothing is pending locally', () => {
    const store = createAppStore();
    store.dispatch(applyAuthProfile(serverProfile));
    expect(store.getState().profile.isComplete).toBe(true);

    store.dispatch(applyAuthProfile(null));

    expect(store.getState().profile.isComplete).toBe(false);
    expect(store.getState().profile.baselineWeightKg).toBeNull();
  });

  // The rule this whole change exists to protect: onboarding finished offline
  // has not reached the server, so the server saying "no profile" is not news.
  it('keeps a profile completed offline when the server says there is none', () => {
    const store = completedOffline();

    store.dispatch(applyAuthProfile(null));

    const profile = store.getState().profile;
    expect(profile.isComplete).toBe(true);
    expect(profile.pendingSync).toBe(true);
    expect(profile.name).toBe('Offline Sam');
    expect(profile.baselineWeightKg).toBe(80);
    expect(profile.targetWeightKg).toBe(74);
  });

  it('does not let a server profile overwrite unpushed local work', () => {
    const store = completedOffline();

    store.dispatch(applyAuthProfile(serverProfile));

    // profileHydrated's own pendingSync guard still applies.
    expect(store.getState().profile.name).toBe('Offline Sam');
    expect(store.getState().profile.baselineWeightKg).toBe(80);
    expect(store.getState().profile.pendingSync).toBe(true);
  });

  it('resets cleanly for an incoming user once isolation has cleared the slice', () => {
    const store = completedOffline();

    // What establishSession's different-user branch does first — unconditional.
    store.dispatch(profileReset());
    expect(store.getState().profile.pendingSync).toBe(false);

    store.dispatch(applyAuthProfile(null));

    expect(store.getState().profile).toEqual(createAppStore().getState().profile);
  });
});
