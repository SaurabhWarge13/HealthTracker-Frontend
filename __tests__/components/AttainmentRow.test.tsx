/**
 * The strip is where the card's honesty is either kept or lost.
 *
 * The domain already distinguishes a gap (`ratio: null`) from a recorded zero
 * (`ratio: 0`). These check that the distinction survives rendering — if a
 * zero drew as nothing, the app would be telling the user they never logged
 * something they did log.
 *
 * The marks are now glyphs rather than bars of varying height (a filled disc
 * for a hit, a hollow ring for a logged miss, a tiny point for a gap), so the
 * assertions are about shape and ink rather than about height.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { Moon } from 'lucide-react-native';
import { AttainmentRow } from '@/components/data';
import { ThemeProvider } from '@/context/ThemeContext';
import type { Attainment, AttainmentBar } from '@/domain/progress/attainment';

const TEST_ID = 'sleep-row';

const attainment = (over: Partial<Attainment> = {}): Attainment => ({
  metric: 'sleep',
  goal: 450,
  recorded: 0,
  hits: 0,
  average: null,
  status: 'notRecorded',
  bars: [],
  ...over,
});

const bar = (at: number, ratio: number | null, hit = false): AttainmentBar => ({
  at,
  ratio,
  hit,
});

const show = (value: Attainment, onSetGoal?: () => void) =>
  render(
    <AttainmentRow
      attainment={value}
      icon={Moon}
      label="Sleep"
      format={minutes => `${minutes}m`}
      onSetGoal={onSetGoal}
      testID={TEST_ID}
    />,
    { wrapper: ThemeProvider },
  );

/** RN flattens a style array left to right; later entries win. */
const styleOf = (node: { props: { style?: unknown } }): Record<string, unknown> =>
  Object.assign({}, ...[node.props.style].flat(3).filter(Boolean));

describe('a gap and a zero must not look alike', () => {
  it('draws a mark for a recorded zero and only a point for a gap', async () => {
    const { queryAllByTestId } = await show(
      attainment({ bars: [bar(1, null), bar(2, 0)], recorded: 1 }),
    );

    // Two slots, one recorded mark, one gap point — never two of either.
    expect(queryAllByTestId(`${TEST_ID}-bar`)).toHaveLength(1);
    expect(queryAllByTestId(`${TEST_ID}-gap`)).toHaveLength(1);
  });

  it('draws a recorded zero as a ring, so ink is present', async () => {
    const { getByTestId } = await show(
      attainment({ bars: [bar(1, 0)], recorded: 1 }),
    );

    const style = styleOf(getByTestId(`${TEST_ID}-bar`));
    // A ring: outlined, deliberately not filled.
    expect(style.borderWidth).toBeGreaterThan(0);
    expect(style.backgroundColor).toBeUndefined();
  });

  it('draws a hit as a filled mark rather than a ring', async () => {
    const { getByTestId } = await show(
      attainment({ bars: [bar(1, 1.2, true)], recorded: 1, hits: 1 }),
    );

    const style = styleOf(getByTestId(`${TEST_ID}-bar`));
    expect(style.backgroundColor).toBeTruthy();
    expect(style.borderWidth).toBeUndefined();
  });

  it('keeps a mark the same size however far it overshoots the goal', async () => {
    // Three times the goal must not blow the strip out and squash the rest.
    const { getByTestId } = await show(
      attainment({ bars: [bar(1, 3, true)], recorded: 1, hits: 1 }),
    );

    const style = styleOf(getByTestId(`${TEST_ID}-bar`));
    expect(style.width).toBe(8);
    expect(style.height).toBe(8);
  });

  it('is a point, not an empty slot, that marks a gap', async () => {
    const { getByTestId } = await show(attainment({ bars: [bar(1, null)] }));

    const style = styleOf(getByTestId(`${TEST_ID}-gap`));
    // Much less ink than a recorded mark, and still visible.
    expect(style.width).toBe(3);
    expect(style.backgroundColor).toBeTruthy();
  });
});

describe('what it says', () => {
  it('names a rate only when one is meaningful', async () => {
    const { getByText } = await show(
      attainment({ status: 'onTrack', recorded: 9, hits: 4, average: 400 }),
    );

    // The rate is the headline: the figure and its denominator.
    expect(getByText('4')).toBeTruthy();
    expect(getByText('/9')).toBeTruthy();
    // And the state is still named in a word, with the average beside it.
    expect(getByText('On track · 400m')).toBeTruthy();
  });

  it('reports a bare count when there is not enough to grade', async () => {
    const { getByText, queryByText } = await show(
      attainment({ status: 'notEnoughData', recorded: 2, hits: 2, average: 480 }),
    );
    expect(getByText(/2 logged/)).toBeTruthy();
    // "2 of 2" would read as a perfect record off two nights.
    expect(queryByText(/2 of 2/)).toBeNull();
    expect(queryByText('/2')).toBeNull();
  });

  it('judges nothing when there is no goal, and offers to set one', async () => {
    const onSetGoal = jest.fn();
    const { getByText, queryByText } = await show(
      attainment({ goal: null, status: 'noGoal', recorded: 4, average: 470 }),
      onSetGoal,
    );

    // The average is all it will say — no rate, no verdict.
    expect(getByText('470m')).toBeTruthy();
    expect(queryByText('/4')).toBeNull();
    expect(getByText('Set a goal')).toBeTruthy();
  });

  it('drops the invitation once a goal exists', async () => {
    const { getByText, queryByText } = await show(
      attainment({ goal: 450, status: 'onTrack', recorded: 4, hits: 4, average: 480 }),
      jest.fn(),
    );

    expect(queryByText('Set a goal')).toBeNull();
    expect(getByText('On track · 480m')).toBeTruthy();
  });

  it('says nothing was logged rather than implying a failure', async () => {
    const { getByText, queryByText } = await show(
      attainment({ status: 'notRecorded', bars: [bar(1, null), bar(2, null)] }),
    );

    expect(getByText('Nothing logged')).toBeTruthy();
    // An em dash, never a zero the user never entered.
    expect(getByText('—')).toBeTruthy();
    expect(queryByText('0')).toBeNull();
  });
});
