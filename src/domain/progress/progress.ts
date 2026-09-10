import type { CheckIn } from '@/domain/checkins/types';

export type ProgressStatus =
  | 'improving'
  | 'steady'
  | 'offTrack'
  | 'notEnoughData';

export type Progress = {
  /** Latest saved check-in's weight. Always a check-in, never a device reading. */
  currentWeightKg: number | null;
  /** The baseline set at onboarding — a stable anchor that outlives deletions. */
  startingWeightKg: number | null;
  /** current − starting. Negative means lighter than the start. */
  deltaKg: number | null;
  status: ProgressStatus;
  entryCount: number;
};

/** Inside this band a change is noise, not movement. */
const STEADY_BAND_KG = 0.3;

/** How many recent entries smooth the status, so one bad weigh-in can't flip it. */
const TREND_WINDOW = 3;

/**
 * `checkIns` must be newest-first. `targetWeightKg` may sit ABOVE or BELOW
 * the current weight — nothing here assumes down is good.
 */
export const calculateProgress = (
  checkIns: readonly CheckIn[],
  baselineWeightKg: number | null,
  targetWeightKg: number | null,
): Progress => {
  const entryCount = checkIns.length;
  const currentWeightKg = entryCount > 0 ? checkIns[0].weightKg : null;
  const startingWeightKg = baselineWeightKg;

  const deltaKg =
    currentWeightKg !== null && startingWeightKg !== null
      ? currentWeightKg - startingWeightKg
      : null;

  return {
    currentWeightKg,
    startingWeightKg,
    deltaKg,
    entryCount,
    status: calculateStatus(checkIns, targetWeightKg),
  };
};

/**
 * Compares the last few check-ins against the distance from target, so a
 * target above the current weight reads as improving when the trend rises.
 * With no target we assume the user wants to move down, but the caller
 * phrases the badge neutrally in that case.
 */
const calculateStatus = (
  checkIns: readonly CheckIn[],
  targetWeightKg: number | null,
): ProgressStatus => {
  if (checkIns.length < 2) {
    return 'notEnoughData';
  }

  const window = checkIns.slice(0, TREND_WINDOW);
  const newest = window[0].weightKg;
  const oldest = window[window.length - 1].weightKg;
  const change = newest - oldest;

  if (Math.abs(change) <= STEADY_BAND_KG) {
    return 'steady';
  }

  if (targetWeightKg === null) {
    return change < 0 ? 'improving' : 'offTrack';
  }

  // Did the newest reading land closer to the target than the oldest did?
  const before = Math.abs(oldest - targetWeightKg);
  const after = Math.abs(newest - targetWeightKg);
  return after < before ? 'improving' : 'offTrack';
};

/** Change against the previous entry, for a row's delta badge. */
export const deltaFromPrevious = (
  checkIn: CheckIn,
  previous: CheckIn | undefined,
): number | null => (previous === undefined ? null : checkIn.weightKg - previous.weightKg);
