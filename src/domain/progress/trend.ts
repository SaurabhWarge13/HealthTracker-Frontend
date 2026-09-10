import type { CheckIn } from '@/domain/checkins/types';

export type TrendPoint = {
  timestamp: number;
  weightKg: number;
  /** True only for the synthetic baseline point. */
  isBaseline: boolean;
};

export type Trend = {
  points: TrendPoint[];
  minKg: number;
  maxKg: number;
  targetKg: number | null;
};

/** `checkIns` newest-first, as the selectors provide. */
export const buildTrend = (
  checkIns: readonly CheckIn[],
  baselineWeightKg: number | null,
  baselineAt: number | null,
  targetWeightKg: number | null,
): Trend => {
  const oldestFirst = [...checkIns].sort((a, b) => a.createdAt - b.createdAt);

  const points: TrendPoint[] = oldestFirst.map(entry => ({
    timestamp: entry.createdAt,
    weightKg: entry.weightKg,
    isBaseline: false,
  }));

  if (baselineWeightKg !== null) {
    // Sit the baseline just before the first entry when its own date is unknown.
    const firstAt = points.length > 0 ? points[0].timestamp : Date.now();
    points.unshift({
      timestamp: baselineAt ?? firstAt - 1,
      weightKg: baselineWeightKg,
      isBaseline: true,
    });
  }

  const weights = points.map(p => p.weightKg);
  const candidates = targetWeightKg !== null ? [...weights, targetWeightKg] : weights;

  return {
    points,
    minKg: candidates.length > 0 ? Math.min(...candidates) : 0,
    maxKg: candidates.length > 0 ? Math.max(...candidates) : 0,
    targetKg: targetWeightKg,
  };
};

/** A line needs two points; one is a dot that reads as a bug. */
export const hasPlottableTrend = (trend: Trend): boolean => trend.points.length >= 2;
