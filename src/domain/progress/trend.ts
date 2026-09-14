import type { CheckIn } from '@/domain/checkins/types';

export type TrendPoint = {
  timestamp: number;
  weightKg: number;
  isBaseline: boolean;
};

export type Trend = {
  points: TrendPoint[];
  minKg: number;
  maxKg: number;
  targetKg: number | null;
};

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

export const hasPlottableTrend = (trend: Trend): boolean => trend.points.length >= 2;
