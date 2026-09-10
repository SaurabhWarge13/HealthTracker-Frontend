/**
 * The card's whole claim is that it does not invent failures. These tests are
 * that claim, written down.
 */
import {
  ATTAINMENT_WINDOW,
  buildAttainment,
  MIN_RECORDED,
} from '@/domain/progress/attainment';
import type { CheckIn } from '@/domain/checkins/types';

let clock = 1_700_000_000_000;

/** Newest-first, the order `selectCheckIns` returns. */
const series = (
  values: (number | null)[],
  metric: 'sleep' | 'water' = 'sleep',
): CheckIn[] =>
  values
    .map((value, index) => ({
      id: `c${index}`,
      createdAt: clock + index * 86_400_000,
      weightKg: 72,
      heightCm: 175,
      steps: null,
      sleepMinutes: metric === 'sleep' ? value : null,
      waterMl: metric === 'water' ? value : null,
      mood: null,
      notes: '',
      sources: {},
    }))
    .reverse();

describe('a blank is not a zero', () => {
  it('leaves gaps out of the denominator entirely', () => {
    // Four nights logged, three of them hit. The six blanks are not misses —
    // they are nights the user did not record, which is normal.
    const result = buildAttainment(
      'sleep',
      series([480, null, 500, null, 460, null, 300, null, null, null]),
      450,
    );

    expect(result.recorded).toBe(4);
    expect(result.hits).toBe(3);
    expect(result.status).toBe('onTrack');
  });

  it('does not let gaps drag the average down', () => {
    const result = buildAttainment('sleep', series([480, null, null, 420]), 450);
    expect(result.average).toBe(450); // (480 + 420) / 2, not / 4
  });

  it('draws a gap as null, distinct from a recorded zero', () => {
    const result = buildAttainment('water', series([null, 0], 'water'), 2000);
    const [gap, zero] = result.bars;

    // If these were the same the strip would show a zero night as "no data",
    // which is the opposite of what the user told us.
    expect(gap.ratio).toBeNull();
    expect(zero.ratio).toBe(0);
  });
});

describe('a zero is a zero', () => {
  it('counts a recorded zero as recorded, and as a miss', () => {
    const result = buildAttainment('water', series([0, 0, 2500], 'water'), 2000);

    expect(result.recorded).toBe(3);
    expect(result.hits).toBe(1);
    expect(result.status).toBe('offTarget');
    expect(result.average).toBeCloseTo(2500 / 3);
  });
});

describe('status', () => {
  const at = (values: (number | null)[], goal: number | null) =>
    buildAttainment('sleep', series(values), goal).status;

  it('names no rate without a goal', () => {
    expect(at([480, 500, 460, 470], null)).toBe('noGoal');
    // A goal of zero cannot be missed, so it is not a goal.
    expect(at([480, 500, 460, 470], 0)).toBe('noGoal');
  });

  it('says nothing was recorded rather than implying failure', () => {
    expect(at([null, null, null], 450)).toBe('notRecorded');
  });

  it('withholds a rate below the minimum sample', () => {
    expect(at([480, 500], 450)).toBe('notEnoughData');
    expect(at([480, 500, 460], 450)).not.toBe('notEnoughData');
  });

  it('grades on the hit rate once there is enough to grade', () => {
    // 3/4 = 0.75 -> on track
    expect(at([480, 480, 480, 300], 450)).toBe('onTrack');
    // 2/4 = 0.5 -> mixed
    expect(at([480, 480, 300, 300], 450)).toBe('mixed');
    // 1/4 = 0.25 -> off target
    expect(at([480, 300, 300, 300], 450)).toBe('offTarget');
  });

  it('treats meeting the goal exactly as a hit', () => {
    const result = buildAttainment('sleep', series([450, 450, 450]), 450);
    expect(result.hits).toBe(3);
    expect(result.status).toBe('onTrack');
  });
});

describe('the window', () => {
  it('reads the last ten check-ins and no more', () => {
    const twenty = Array.from({ length: 20 }, () => 480);
    const result = buildAttainment('sleep', series(twenty), 450);
    expect(result.bars).toHaveLength(ATTAINMENT_WINDOW);
    expect(result.recorded).toBe(ATTAINMENT_WINDOW);
  });

  it('takes the NEWEST ten, not the oldest', () => {
    // Oldest five missed, newest ten hit. Reading the wrong end would grade
    // this on history the user has already moved past.
    const values = [...Array(5).fill(300), ...Array(10).fill(480)];
    const result = buildAttainment('sleep', series(values), 450);
    expect(result.hits).toBe(10);
    expect(result.status).toBe('onTrack');
  });

  it('orders bars oldest to newest, so the strip reads left to right', () => {
    const result = buildAttainment('sleep', series([100, 200, 300]), 450);
    const times = result.bars.map(bar => bar.at);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('survives an empty history', () => {
    const result = buildAttainment('sleep', [], 450);
    expect(result.recorded).toBe(0);
    expect(result.hits).toBe(0);
    expect(result.average).toBeNull();
    expect(result.bars).toEqual([]);
    expect(result.status).toBe('notRecorded');
  });
});

describe('bars', () => {
  it('scales against the goal when there is one', () => {
    const result = buildAttainment('sleep', series([225, 450, 900]), 450);
    expect(result.bars.map(bar => bar.ratio)).toEqual([0.5, 1, 2]);
  });

  it('scales against the biggest value when there is no goal', () => {
    // Still a readable shape, without pretending to a standard nobody set.
    const result = buildAttainment('sleep', series([200, 400]), null);
    expect(result.bars.map(bar => bar.ratio)).toEqual([0.5, 1]);
  });

  it('marks no bar as a hit when there is no goal', () => {
    const result = buildAttainment('sleep', series([480, 500]), null);
    expect(result.bars.every(bar => !bar.hit)).toBe(true);
  });

  it('has no scale to divide by when nothing was recorded', () => {
    const result = buildAttainment('sleep', series([null, null]), null);
    expect(result.bars.every(bar => bar.ratio === null)).toBe(true);
  });
});

describe('metrics are read independently', () => {
  it('reads water without seeing sleep', () => {
    const entries = series([2500, 2500], 'water');
    expect(buildAttainment('water', entries, 2000).recorded).toBe(2);
    // The same check-ins carry no sleep, so sleep is all gaps.
    expect(buildAttainment('sleep', entries, 450).recorded).toBe(0);
  });
});

describe('the constants mean what the copy says', () => {
  it('needs at least MIN_RECORDED values before naming a rate', () => {
    const under = Array(MIN_RECORDED - 1).fill(480);
    const enough = Array(MIN_RECORDED).fill(480);
    expect(buildAttainment('sleep', series(under), 450).status).toBe('notEnoughData');
    expect(buildAttainment('sleep', series(enough), 450).status).toBe('onTrack');
  });
});
