import { selectCheckInsUnsettled } from '@/store/checkins/checkinsSelectors';
import {
  checkInsFetchFailed,
  checkInsFetchStarted,
  checkInsReplaced,
  initialCheckInsState,
  checkinsReducer,
} from '@/store/checkins/checkinsSlice';
import { initialConnectivityState } from '@/store/network/connectivitySlice';
import type { CheckIn } from '@/domain/checkins/types';
import type { RootState } from '@/store/rootReducer';

const checkIn: CheckIn = {
  id: 'srv_1',
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

const stateWith = (
  checkins = initialCheckInsState,
  isOnline = true,
): RootState =>
  ({
    checkins,
    connectivity: { ...initialConnectivityState, isOnline },
  } as RootState);

describe('selectCheckInsUnsettled', () => {
  it('waits before claiming an account is empty', () => {
    expect(selectCheckInsUnsettled(stateWith())).toBe(true);
  });

  it('waits while a request is on the wire', () => {
    const checkins = checkinsReducer(
      initialCheckInsState,
      checkInsFetchStarted(1_000),
    );
    expect(selectCheckInsUnsettled(stateWith(checkins))).toBe(true);
  });

  it('settles once the list arrives, even when it is empty', () => {
    const checkins = checkinsReducer(
      initialCheckInsState,
      checkInsReplaced({ entries: [], at: 2_000 }),
    );
    expect(selectCheckInsUnsettled(stateWith(checkins))).toBe(false);
  });

  it('settles when the fetch failed — we asked, and got nothing', () => {
    const checkins = [checkInsFetchStarted(1_000), checkInsFetchFailed()].reduce(
      checkinsReducer,
      initialCheckInsState,
    );
    expect(selectCheckInsUnsettled(stateWith(checkins))).toBe(false);
  });

  it('never waits when there is data to show', () => {
    const checkins = checkinsReducer(
      initialCheckInsState,
      checkInsReplaced({ entries: [checkIn], at: 2_000 }),
    );
    expect(selectCheckInsUnsettled(stateWith(checkins))).toBe(false);
  });

  it('shows a restored list immediately, before any fetch', () => {
    const restored = {
      ...initialCheckInsState,
      byId: { srv_1: checkIn },
      allIds: ['srv_1'],
    };
    expect(selectCheckInsUnsettled(stateWith(restored))).toBe(false);
  });

  it('does not wait when offline — nothing is coming', () => {
    expect(selectCheckInsUnsettled(stateWith(initialCheckInsState, false))).toBe(
      false,
    );
  });
});

describe('checkInsFetchStarted', () => {
  it('records the attempt as well as the flag', () => {
    const state = checkinsReducer(initialCheckInsState, checkInsFetchStarted(1_000));
    expect(state.loading).toBe(true);
    expect(state.lastAttemptAt).toBe(1_000);
    expect(state.fetchedAt).toBeNull();
  });

  it('keeps the attempt recorded after a failure', () => {
    const state = [checkInsFetchStarted(1_000), checkInsFetchFailed()].reduce(
      checkinsReducer,
      initialCheckInsState,
    );
    expect(state.loading).toBe(false);
    expect(state.lastAttemptAt).toBe(1_000);
    expect(state.fetchedAt).toBeNull();
  });
});
