/**
 * The two helpers history's day grouping rests on.
 *
 * Every date below is built with the local-time `Date` constructor, so these
 * assertions hold in any timezone — and would fail if either helper reached
 * for `toISOString()`, which files a 00:30 check-in under the previous UTC day
 * for anyone west of Greenwich.
 */
import { dayKey, formatDayTitle, isSameDay } from '@/utils/formatters';

describe('dayKey', () => {
  it('is the local calendar date, zero-padded', () => {
    expect(dayKey(new Date(2026, 8, 8, 12, 0).getTime())).toBe('2026-09-08');
    expect(dayKey(new Date(2026, 0, 1, 12, 0).getTime())).toBe('2026-01-01');
  });

  it('keeps a just-after-midnight check-in on its own local day', () => {
    // The case a UTC key gets wrong.
    expect(dayKey(new Date(2026, 8, 8, 0, 30).getTime())).toBe('2026-09-08');
    expect(dayKey(new Date(2026, 8, 8, 23, 30).getTime())).toBe('2026-09-08');
  });

  it('groups two check-ins on the same day together', () => {
    const morning = new Date(2026, 8, 8, 8, 12).getTime();
    const evening = new Date(2026, 8, 8, 20, 12).getTime();
    expect(dayKey(morning)).toBe(dayKey(evening));
  });

  it('splits check-ins either side of midnight', () => {
    const late = new Date(2026, 8, 8, 23, 59).getTime();
    const early = new Date(2026, 8, 9, 0, 1).getTime();
    expect(dayKey(late)).not.toBe(dayKey(early));
  });

  it('sorts as a string, because it is padded', () => {
    const keys = [
      dayKey(new Date(2026, 8, 10).getTime()),
      dayKey(new Date(2026, 8, 2).getTime()),
      dayKey(new Date(2026, 7, 30).getTime()),
    ];
    expect([...keys].sort()).toEqual([
      '2026-08-30',
      '2026-09-02',
      '2026-09-10',
    ]);
  });
});

describe('formatDayTitle', () => {
  const now = new Date(2026, 8, 9, 10, 0).getTime();

  it('leaves the year off inside the current one', () => {
    expect(formatDayTitle(new Date(2026, 8, 8).getTime(), now)).toBe('Tue, 8 Sep');
  });

  it('adds the year once it is a different one', () => {
    expect(formatDayTitle(new Date(2025, 9, 8).getTime(), now)).toBe(
      'Wed, 8 Oct 2025',
    );
  });

  it('stays mixed case, so a screen reader does not spell it out', () => {
    const title = formatDayTitle(new Date(2026, 8, 8).getTime(), now);
    expect(title).not.toBe(title.toUpperCase());
  });
});

describe('isSameDay', () => {
  it('compares local calendar days, not instants', () => {
    expect(
      isSameDay(new Date(2026, 8, 8, 0, 1), new Date(2026, 8, 8, 23, 59)),
    ).toBe(true);
    expect(
      isSameDay(new Date(2026, 8, 8, 23, 59), new Date(2026, 8, 9, 0, 1)),
    ).toBe(false);
  });
});
