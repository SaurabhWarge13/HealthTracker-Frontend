import type { CheckIn } from '@/domain/checkins/types';

export type TargetMetric = 'sleep' | 'water';

/**
 * The last ten check-ins, not the last ten days. People check in irregularly,
 * and calling an irregular series "days" would be a quiet lie — so the copy
 * says "check-ins" and so does this.
 */
export const ATTAINMENT_WINDOW = 10;

/** Below three recorded values a rate is noise, so none is named. */
export const MIN_RECORDED = 3;

/** Seven in ten is "mostly"; under four in ten is "usually not". */
const ON_TRACK_RATE = 0.7;
const MIXED_RATE = 0.4;

export type AttainmentStatus =
  /** Hitting it most of the time. */
  | 'onTrack'
  /** Hitting it sometimes. */
  | 'mixed'
  /** Usually not hitting it. */
  | 'offTarget'
  /** No goal to measure against — show the average and judge nothing. */
  | 'noGoal'
  /** A goal, but nothing logged in the window. Say so; do not imply failure. */
  | 'notRecorded'
  /** One or two entries. Show the average, name no rate. */
  | 'notEnoughData';

export type AttainmentBar = {
  /** The check-in's timestamp, for keys and accessibility labels. */
  at: number;
  /**
   * How full to draw the bar, 0–1+, or `null` when nothing was recorded.
   *
   * `null` is a gap and must render differently from `0` — a zero is a real
   * value the user entered. Against a goal this is `value / goal`; with no goal
   * it is `value / largest in the window`, so the strip still shows the shape
   * of the habit without implying a verdict.
   */
  ratio: number | null;
  /** Met or beat the goal. Always false when there is no goal. */
  hit: boolean;
};

export type Attainment = {
  metric: TargetMetric;
  /** Normalised: a goal of zero is not a goal, so it arrives here as null. */
  goal: number | null;
  /** How many of the window actually carried a value. The denominator. */
  recorded: number;
  hits: number;
  /** Mean of the recorded values only — gaps do not drag it down. */
  average: number | null;
  status: AttainmentStatus;
  /** Oldest → newest, so the strip reads left to right like a sentence. */
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

/**
 * `checkIns` must be newest-first — the order `selectCheckIns` already returns.
 */
export function buildAttainment(
  metric: TargetMetric,
  checkIns: readonly CheckIn[],
  goal: number | null,
): Attainment {
  const read = VALUE_OF[metric];
  const oldestFirst = checkIns.slice(0, ATTAINMENT_WINDOW).reverse();
  const values = oldestFirst.map(read);

  // A zero target cannot be missed, so it is not a target.
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

  /**
   * What a full bar means. The goal when there is one; otherwise the largest
   * value in the window, which keeps the strip readable as a relative shape
   * rather than pretending to a standard nobody set.
   */
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
