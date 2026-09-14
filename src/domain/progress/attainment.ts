import type { CheckIn } from '@/domain/checkins/types';

export type TargetMetric = 'sleep' | 'water';

export const ATTAINMENT_WINDOW = 10;

export const MIN_RECORDED = 3;

const ON_TRACK_RATE = 0.7;
const MIXED_RATE = 0.4;

export type AttainmentStatus =
  | 'onTrack'
  | 'mixed'
  | 'offTarget'
  | 'noGoal'
  | 'notRecorded'
  | 'notEnoughData';

export type AttainmentBar = {
  at: number;
  ratio: number | null;
  hit: boolean;
};

export type Attainment = {
  metric: TargetMetric;
  goal: number | null;
  recorded: number;
  hits: number;
  average: number | null;
  status: AttainmentStatus;
  bars: AttainmentBar[];
};

const VALUE_OF: Record<TargetMetric, (checkIn: CheckIn) => number | null> = {
  sleep: checkIn => checkIn.sleepMinutes,
  water: checkIn => checkIn.waterMl,
};

function statusFor(
  goal: number | null,
  recorded: number,
  hits: number,
): AttainmentStatus {
  if (goal === null) {
    return 'noGoal';
  }
  if (recorded === 0) {
    return 'notRecorded';
  }
  if (recorded < MIN_RECORDED) {
    return 'notEnoughData';
  }
  const rate = hits / recorded;
  if (rate >= ON_TRACK_RATE) {
    return 'onTrack';
  }
  return rate >= MIXED_RATE ? 'mixed' : 'offTarget';
}

export function buildAttainment(
  metric: TargetMetric,
  checkIns: readonly CheckIn[],
  goal: number | null,
): Attainment {
  const read = VALUE_OF[metric];
  const oldestFirst = checkIns.slice(0, ATTAINMENT_WINDOW).reverse();
  const values = oldestFirst.map(read);

  const target = goal !== null && goal > 0 ? goal : null;

  const recordedValues = values.filter((value): value is number => value !== null);
  const recorded = recordedValues.length;

  const hits =
    target === null
      ? 0
      : recordedValues.filter(value => value >= target).length;

  const average =
    recorded === 0
      ? null
      : recordedValues.reduce((total, value) => total + value, 0) / recorded;

  const peak = recorded === 0 ? 0 : Math.max(...recordedValues);
  const scale = target ?? (peak > 0 ? peak : null);

  const bars: AttainmentBar[] = oldestFirst.map((checkIn, index) => {
    const value = values[index];
    return {
      at: checkIn.createdAt,
      ratio: value === null || scale === null ? null : value / scale,
      hit: target !== null && value !== null && value >= target,
    };
  });

  return {
    metric,
    goal: target,
    recorded,
    hits,
    average,
    status: statusFor(target, recorded, hits),
    bars,
  };
}
