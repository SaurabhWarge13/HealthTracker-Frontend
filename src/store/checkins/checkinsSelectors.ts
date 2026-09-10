import { createSelector } from '@reduxjs/toolkit';
import type { CheckIn } from '@/domain/checkins/types';
import { buildAttainment } from '@/domain/progress/attainment';
import { currentBmi } from '@/domain/progress/bmi';
import { calculateProgress, deltaFromPrevious } from '@/domain/progress/progress';
import { buildTrend } from '@/domain/progress/trend';
import type { RootState } from '@/store/rootReducer';

const selectById = (state: RootState) => state.checkins.byId;
const selectAllIds = (state: RootState) => state.checkins.allIds;

/**
 * What the skeleton keys on, rather than `loading`.
 *
 * `loading` is only true while a request is on the wire, and a screen paints
 * before its effects run. In that gap an account with no data looks identical
 * to one whose data has not been asked for yet, so the empty state would
 * appear, get replaced by a skeleton, then reappear.
 */
export const selectCheckInsUnsettled = (state: RootState): boolean => {
  const { loading, fetchedAt, lastAttemptAt, allIds } = state.checkins;

  if (loading) {
    return true;
  }
  // Anything on the device is worth showing immediately; a refresh behind it
  // is silent.
  if (allIds.length > 0) {
    return false;
  }
  // We have looked at least once. Empty means empty.
  if (fetchedAt !== null || lastAttemptAt !== null) {
    return false;
  }
  // Never looked. Offline, that is the final answer; online, a request is
  // moments away and worth waiting for.
  return state.connectivity.isOnline;
};

/**
 * Newest first. Pending sync state is surfaced separately through
 * `selectPendingEntityIds`, so a row can show its waiting-to-sync clock
 * without this having to fold in the outbox.
 */
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

/** The entry saved immediately before this one, for its delta badge. */
export const selectPreviousCheckIn = (id: string) =>
  createSelector(selectCheckIns, entries => {
    const index = entries.findIndex(e => e.id === id);
    return index === -1 ? null : entries[index + 1] ?? null;
  });

/** Newest entry, used to prefill the next check-in's weight. */
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

/**
 * Reads check-ins and the two goals, and nothing else — in particular not
 * `state.healthConnect`. A saved check-in's numbers are the user's from the
 * moment they saved them, so if this read the device instead, revoking a
 * Health Connect permission would appear to erase history the user still has.
 */
export const selectSleepAndWater = createSelector(
  [selectCheckIns, selectSleepGoal, selectWaterGoal],
  (entries, sleepGoal, waterGoal) => ({
    sleep: buildAttainment('sleep', entries, sleepGoal),
    water: buildAttainment('water', entries, waterGoal),
  }),
);

/** Each entry paired with its change from the previous one. */
export const selectCheckInsWithDelta = createSelector(selectCheckIns, entries =>
  entries.map((entry, index) => ({
    checkIn: entry,
    deltaKg: deltaFromPrevious(entry, entries[index + 1]),
  })),
);
