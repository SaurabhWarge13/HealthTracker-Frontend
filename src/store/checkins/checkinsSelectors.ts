import { createSelector } from '@reduxjs/toolkit';
import type { CheckIn } from '@/domain/checkins/types';
import { buildAttainment } from '@/domain/progress/attainment';
import { currentBmi } from '@/domain/progress/bmi';
import { calculateProgress, deltaFromPrevious } from '@/domain/progress/progress';
import { buildTrend } from '@/domain/progress/trend';
import type { RootState } from '@/store/rootReducer';

const selectById = (state: RootState) => state.checkins.byId;
const selectAllIds = (state: RootState) => state.checkins.allIds;

export const selectCheckInsUnsettled = (state: RootState): boolean => {
  const { loading, fetchedAt, lastAttemptAt, allIds } = state.checkins;

  if (loading) {
    return true;
  }
  if (allIds.length > 0) {
    return false;
  }
  if (fetchedAt !== null || lastAttemptAt !== null) {
    return false;
  }
  return state.connectivity.isOnline;
};

export const selectCheckIns = createSelector(
  [selectById, selectAllIds],
  (byId, allIds): CheckIn[] =>
    allIds
      .map(id => byId[id])
      .filter((entry): entry is CheckIn => entry !== undefined)
      .sort((a, b) => b.createdAt - a.createdAt),
);

export const selectCheckInCount = createSelector(
  selectCheckIns,
  entries => entries.length,
);

export const selectRecentCheckIns = createSelector(selectCheckIns, entries =>
  entries.slice(0, 3),
);

export const selectCheckInById = (id: string) =>
  createSelector(selectCheckIns, entries => entries.find(e => e.id === id) ?? null);

export const selectPreviousCheckIn = (id: string) =>
  createSelector(selectCheckIns, entries => {
    const index = entries.findIndex(e => e.id === id);
    return index === -1 ? null : entries[index + 1] ?? null;
  });

export const selectLatestCheckIn = createSelector(
  selectCheckIns,
  entries => entries[0] ?? null,
);

const selectBaselineWeight = (state: RootState) => state.profile.baselineWeightKg;
const selectTargetWeight = (state: RootState) => state.profile.targetWeightKg;
const selectProfileHeight = (state: RootState) => state.profile.heightCm;
const selectBaselineAt = (state: RootState) => state.profile.baselineSetAt;

export const selectProgress = createSelector(
  [selectCheckIns, selectBaselineWeight, selectTargetWeight],
  calculateProgress,
);

export const selectBmi = createSelector(
  [selectCheckIns, selectProfileHeight],
  currentBmi,
);

export const selectTrend = createSelector(
  [selectCheckIns, selectBaselineWeight, selectBaselineAt, selectTargetWeight],
  buildTrend,
);

const selectSleepGoal = (state: RootState) => state.profile.sleepGoalMinutes;
const selectWaterGoal = (state: RootState) => state.profile.waterGoalMl;

export const selectSleepAndWater = createSelector(
  [selectCheckIns, selectSleepGoal, selectWaterGoal],
  (entries, sleepGoal, waterGoal) => ({
    sleep: buildAttainment('sleep', entries, sleepGoal),
    water: buildAttainment('water', entries, waterGoal),
  }),
);

export const selectCheckInsWithDelta = createSelector(selectCheckIns, entries =>
  entries.map((entry, index) => ({
    checkIn: entry,
    deltaKg: deltaFromPrevious(entry, entries[index + 1]),
  })),
);
