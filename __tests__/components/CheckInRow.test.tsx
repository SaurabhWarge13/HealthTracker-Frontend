import React from 'react';
import { render } from '@testing-library/react-native';
import { CheckInRow } from '@/components/data';
import { ThemeProvider } from '@/context/ThemeContext';
import type { CheckIn } from '@/domain/checkins/types';

const TEST_ID = 'row';
const AT = new Date(2026, 8, 8, 20, 12).getTime();
const NOW = new Date(2026, 8, 9, 10, 0).getTime();

const checkIn = (over: Partial<CheckIn> = {}): CheckIn => ({
  id: 'c1',
  createdAt: AT,
  weightKg: 72,
  heightCm: null,
  steps: null,
  sleepMinutes: null,
  waterMl: null,
  mood: null,
  notes: '',
  sources: {},
  ...over,
});

const show = (entry: CheckIn, over: Record<string, unknown> = {}) =>
  render(
    <CheckInRow
      checkIn={entry}
      deltaKg={-0.3}
      variant="metrics"
      sleepGoalMinutes={450}
      waterGoalMl={2000}
      now={NOW}
      testID={TEST_ID}
      onPress={() => {}}
      {...over}
    />,
    { wrapper: ThemeProvider },
  );

const styleOf = (node: { props: { style?: unknown } }): Record<string, unknown> =>
  Object.assign({}, ...[node.props.style].flat(3).filter(Boolean));

describe('a blank and a logged zero must not look alike', () => {
  it('gives a logged zero a track, so it reads as a real answer', async () => {
    const { getByTestId } = await show(checkIn({ waterMl: 0 }));

    const style = styleOf(getByTestId(`${TEST_ID}-water`));
    expect(style.backgroundColor).toBeTruthy();
  });

  it('gives a blank no track at all', async () => {
    const { getByTestId } = await show(checkIn({ waterMl: null }));

    const style = styleOf(getByTestId(`${TEST_ID}-water`));
    expect(style.backgroundColor).toBeUndefined();
  });

  it('says which is which in words, for a screen reader', async () => {
    const zero = await show(checkIn({ waterMl: 0, sleepMinutes: 480 }));
    expect(
      zero.getByLabelText(/Water 0\.0 L, goal missed/),
    ).toBeTruthy();

    const blank = await show(checkIn({ waterMl: null }));
    expect(blank.getByLabelText(/Water not logged/)).toBeTruthy();
  });
});

describe('the meter against a goal', () => {
  it('fills fully once the goal is met', async () => {
    const { getByTestId } = await show(checkIn({ sleepMinutes: 480 }));
    const fill = styleOf(getByTestId(`${TEST_ID}-sleep`).props.children);
    expect(fill.width).toBe(48);
  });

  it('fills part-way under the goal, but never to nothing', async () => {
    const { getByTestId } = await show(checkIn({ sleepMinutes: 225 }));
    const fill = styleOf(getByTestId(`${TEST_ID}-sleep`).props.children);
    expect(fill.width).toBeGreaterThan(0);
    expect(fill.width).toBeLessThan(48);
  });

  it('passes no judgement when no goal is set', async () => {
    const { getByTestId, getByLabelText } = await show(
      checkIn({ sleepMinutes: 400 }),
      { sleepGoalMinutes: null },
    );

    expect(styleOf(getByTestId(`${TEST_ID}-sleep`)).backgroundColor).toBeUndefined();
    expect(getByLabelText(/Sleep 6h 40m\./)).toBeTruthy();
  });

  it('treats a goal of zero as no goal', async () => {
    const { getByTestId } = await show(checkIn({ waterMl: 500 }), {
      waterGoalMl: 0,
    });
    expect(styleOf(getByTestId(`${TEST_ID}-water`)).backgroundColor).toBeUndefined();
  });
});

describe('what the row says', () => {
  it('leads with the weight and gives only the time', async () => {
    const { getByText, queryByText } = await show(checkIn());
    expect(getByText('72.0')).toBeTruthy();
    expect(getByText('8:12 PM')).toBeTruthy();
    expect(queryByText(/8 Sep/)).toBeNull();
  });

  it('still speaks the full date, which the row no longer shows', async () => {
    const { getByLabelText } = await show(checkIn());
    expect(getByLabelText(/Tue, 8 Sep, 8:12 PM/)).toBeTruthy();
  });

  it('says there is nothing to compare against rather than implying no change', async () => {
    const { getByLabelText } = await show(checkIn(), { deltaKg: null });
    expect(getByLabelText(/no previous check-in/)).toBeTruthy();
  });

  it('names a recorded mood and admits an absent one', async () => {
    const withMood = await show(checkIn({ mood: 4 }));
    expect(withMood.getByLabelText(/Feeling good/)).toBeTruthy();

    const without = await show(checkIn({ mood: null }));
    expect(without.getByLabelText(/Mood not recorded/)).toBeTruthy();
  });
});

describe('the default variant is untouched', () => {
  it('still leads with the date and the time-and-weight meta line', async () => {
    const { getByText } = await render(
      <CheckInRow
        checkIn={checkIn()}
        deltaKg={-0.3}
        now={NOW}
        onPress={() => {}}
      />,
      { wrapper: ThemeProvider },
    );

    expect(getByText('Tue, 8 Sep')).toBeTruthy();
    expect(getByText('8:12 PM · 72.0 kg')).toBeTruthy();
  });
});
