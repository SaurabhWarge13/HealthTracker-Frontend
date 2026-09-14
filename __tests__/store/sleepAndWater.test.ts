import { selectSleepAndWater } from '@/store/checkins/checkinsSelectors';
import { checkInsReplaced } from '@/store/checkins/checkinsSlice';
import { healthConnectSynced } from '@/store/healthConnect/healthConnectSlice';
import { profileEdited } from '@/store/profile/profileSlice';
import { createAppStore } from '@/store/store';
import type { CheckIn } from '@/domain/checkins/types';

const night = (id: string, sleepMinutes: number | null): CheckIn => ({
  id,
  createdAt: 1_700_000_000_000 + Number(id.slice(1)) * 86_400_000,
  weightKg: 72,
  heightCm: 175,
  steps: null,
  sleepMinutes,
  waterMl: 2500,
  mood: null,
  notes: '',
  sources: { sleep: 'healthConnect', water: 'healthConnect' },
});

const seeded = () => {
  const store = createAppStore();
  store.dispatch(
    checkInsReplaced({
      entries: [night('c3', 480), night('c2', 500), night('c1', 300)],
      at: 1,
    }),
  );
  store.dispatch(profileEdited({ sleepGoalMinutes: 450, waterGoalMl: 2000 }));
  return store;
};

describe('selectSleepAndWater', () => {
  it('reads check-ins and the goals', () => {
    const { sleep, water } = selectSleepAndWater(seeded().getState());

    expect(sleep.goal).toBe(450);
    expect(sleep.recorded).toBe(3);
    expect(sleep.hits).toBe(2);
    expect(sleep.status).toBe('mixed');
    expect(water.recorded).toBe(3);
  });

  it('does not change when Health Connect permissions are revoked', () => {
    const store = seeded();
    const before = selectSleepAndWater(store.getState());

    store.dispatch(
      healthConnectSynced({
        status: 'NOT_CONNECTED',
        availability: {
          weight: 'PERMISSION_DENIED',
          height: 'PERMISSION_DENIED',
          steps: 'PERMISSION_DENIED',
          sleep: 'PERMISSION_DENIED',
          water: 'PERMISSION_DENIED',
        },
      }),
    );

    const after = selectSleepAndWater(store.getState());

    expect(after).toBe(before);
    expect(after.sleep.recorded).toBe(3);
  });

  it('does not change when today’s device readings change', () => {
    const store = seeded();
    const before = selectSleepAndWater(store.getState());

    store.dispatch(
      healthConnectSynced({
        status: 'CONNECTED',
        today: { sleepMinutes: 999, waterMl: 9_999, steps: 12_000, syncedAt: 3 },
      }),
    );

    expect(selectSleepAndWater(store.getState())).toBe(before);
  });

  it('does change when a goal changes', () => {
    const store = seeded();
    const before = selectSleepAndWater(store.getState());

    store.dispatch(profileEdited({ sleepGoalMinutes: 600 }));
    const after = selectSleepAndWater(store.getState());

    expect(after).not.toBe(before);
    expect(after.sleep.hits).toBe(0);
    expect(after.sleep.status).toBe('offTarget');
  });
});
