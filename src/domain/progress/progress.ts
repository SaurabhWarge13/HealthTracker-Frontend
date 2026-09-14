import type { CheckIn } from '@/domain/checkins/types';

export type ProgressStatus =
  | 'improving'
  | 'steady'
  | 'offTrack'
  | 'notEnoughData';

export type Progress = {
  currentWeightKg: number | null;
  startingWeightKg: number | null;
  deltaKg: number | null;
  status: ProgressStatus;
  entryCount: number;
};

const STEADY_BAND_KG = 0.3;

const TREND_WINDOW = 3;

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

  const before = Math.abs(oldest - targetWeightKg);
  const after = Math.abs(newest - targetWeightKg);
  return after < before ? 'improving' : 'offTrack';
};

export const deltaFromPrevious = (
  checkIn: CheckIn,
  previous: CheckIn | undefined,
): number | null => (previous === undefined ? null : checkIn.weightKg - previous.weightKg);
