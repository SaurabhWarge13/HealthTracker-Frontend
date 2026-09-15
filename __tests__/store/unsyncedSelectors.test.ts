import { createAppStore } from '@/store/store';
import { createCheckIn } from '@/store/checkins/checkinsCommands';
import { opFailed } from '@/store/sync/syncSlice';
import {
  profileCompleted,
  profileSynced,
  profileSyncFailed,
} from '@/store/profile/profileSlice';
import { selectUnsyncedCount } from '@/store/sync/syncSelectors';
import type { CheckInDraft } from '@/domain/checkins/types';

const draft = (weightKg: number): CheckInDraft => ({
  weightKg,
  heightCm: 175,
  steps: null,
  sleepMinutes: null,
  waterMl: null,
  mood: null,
  notes: '',
  sources: {},
});

const completeProfile = () =>
  profileCompleted({
    name: 'Alice',
    baselineWeightKg: 75,
    heightCm: 175,
    stepGoal: null,
    waterGoalMl: null,
    sleepGoalMinutes: null,
    targetWeightKg: null,
    baselineSetAt: 1_700_000_000_000,
  });

describe('selectUnsyncedCount', () => {
  it('is zero on a clean store', () => {
    const store = createAppStore();
    expect(selectUnsyncedCount(store.getState())).toBe(0);
  });

  it('counts pending ops', () => {
    const store = createAppStore();
    store.dispatch(createCheckIn(draft(72)));
    store.dispatch(createCheckIn(draft(73)));
    expect(selectUnsyncedCount(store.getState())).toBe(2);
  });

  it('counts permanently failed ops too', () => {
    const store = createAppStore();
    store.dispatch(createCheckIn(draft(72)));
    const [op] = store.getState().sync.ops;
    store.dispatch(
      opFailed({ opId: op.opId, message: 'nope', kind: 'server' }),
    );

    expect(store.getState().sync.ops[0].failed).toBe(true);
    expect(selectUnsyncedCount(store.getState())).toBe(1);
  });

  it('counts an unsynced profile as one', () => {
    const store = createAppStore();
    store.dispatch(completeProfile());

    expect(store.getState().profile.pendingSync).toBe(true);
    expect(selectUnsyncedCount(store.getState())).toBe(1);
  });

  it('counts a failed profile as one', () => {
    const store = createAppStore();
    store.dispatch(completeProfile());
    store.dispatch(profileSynced());
    store.dispatch(profileSyncFailed('nope'));

    expect(store.getState().profile.pendingSync).toBe(false);
    expect(selectUnsyncedCount(store.getState())).toBe(1);
  });

  it('does not double-count a profile that is both pending and failed', () => {
    const store = createAppStore();
    store.dispatch(completeProfile());
    store.dispatch(profileSyncFailed('nope'));

    expect(selectUnsyncedCount(store.getState())).toBe(1);
  });

  it('sums pending ops, failed ops and the profile', () => {
    const store = createAppStore();
    store.dispatch(completeProfile());
    store.dispatch(createCheckIn(draft(72)));
    store.dispatch(createCheckIn(draft(73)));
    const [first] = store.getState().sync.ops;
    store.dispatch(
      opFailed({ opId: first.opId, message: 'nope', kind: 'server' }),
    );

    expect(selectUnsyncedCount(store.getState())).toBe(3);
  });

  it('drops back to zero once everything syncs', () => {
    const store = createAppStore();
    store.dispatch(completeProfile());
    store.dispatch(profileSynced());

    expect(selectUnsyncedCount(store.getState())).toBe(0);
  });
});
