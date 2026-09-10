/**
 * The reminder's two claims, written down: it fires at the next 8:00 PM, and
 * it exists only when the user wants it AND the OS will deliver it.
 *
 * All of the interesting cases are boundaries — 8:00 PM exactly, a
 * daylight-saving night — and none of them are reachable by tapping around an
 * emulator, which is why the decision is a pure function in the first place.
 */
import {
  REMINDER_HOUR,
  nextReminderAt,
  reconcileReminder,
} from '@/domain/notifications/schedule';

/** Local time, because that is what the user set and what setHours reads. */
const at = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
  second = 0,
): number => new Date(year, month - 1, day, hour, minute, second).getTime();

const asDate = (timestamp: number) => new Date(timestamp);

describe('nextReminderAt', () => {
  it('picks tonight when 8 PM has not happened yet', () => {
    const result = nextReminderAt(at(2026, 3, 10, 19, 59));

    expect(asDate(result).getDate()).toBe(10);
    expect(asDate(result).getHours()).toBe(REMINDER_HOUR);
    expect(asDate(result).getMinutes()).toBe(0);
  });

  it('picks tomorrow at exactly 8:00:00 PM', () => {
    // Strictly after, deliberately. A trigger scheduled for the instant it is
    // computed either fires immediately or not at all, depending on how long
    // the surrounding code takes — the worst kind of bug to reproduce.
    const result = nextReminderAt(at(2026, 3, 10, 20, 0, 0));

    expect(asDate(result).getDate()).toBe(11);
    expect(asDate(result).getHours()).toBe(REMINDER_HOUR);
  });

  it('picks tomorrow once the evening has passed', () => {
    const result = nextReminderAt(at(2026, 3, 10, 20, 1));

    expect(asDate(result).getDate()).toBe(11);
  });

  it('picks tonight from the early hours of the morning', () => {
    // 3 AM is still "today" to a person, and the reminder should not skip a
    // day just because they were awake at an odd hour.
    const result = nextReminderAt(at(2026, 3, 10, 3, 0));

    expect(asDate(result).getDate()).toBe(10);
    expect(asDate(result).getHours()).toBe(REMINDER_HOUR);
  });

  it('is still 8 PM local on the day the clocks change', () => {
    /**
     * The regression this exists for: rolling over with `+ 24 * 60 * 60 * 1000`
     * instead of `setDate` lands the reminder at 19:00 or 21:00 for everyone
     * in a DST timezone, twice a year, silently.
     *
     * Asserted on the local hour rather than a fixed epoch so the test says
     * the same thing in every timezone the suite might run in — including the
     * ones with no DST at all, where it simply cannot fail.
     */
    const springForward = at(2026, 3, 7, 21, 0); // evening before a US change
    const result = nextReminderAt(springForward);

    expect(asDate(result).getHours()).toBe(REMINDER_HOUR);
    expect(asDate(result).getMinutes()).toBe(0);
  });
});

describe('reconcileReminder', () => {
  const now = at(2026, 3, 10, 12, 0);

  it('schedules when the reminder is wanted and permitted', () => {
    expect(reconcileReminder({ enabled: true, permitted: true }, now)).toEqual({
      action: 'schedule',
      at: nextReminderAt(now),
    });
  });

  it('cancels when the user has not asked for it', () => {
    expect(reconcileReminder({ enabled: false, permitted: true }, now)).toEqual({
      action: 'cancel',
    });
  });

  it('cancels when notifications are not permitted', () => {
    // The revoke path: permission turned off in system settings while the app
    // was backgrounded. Cancelling matters as much as the UI correcting
    // itself — a schedule the OS will refuse to deliver is worse than none,
    // because nothing anywhere says so.
    expect(reconcileReminder({ enabled: true, permitted: false }, now)).toEqual({
      action: 'cancel',
    });
  });

  it('cancels when neither is true', () => {
    expect(reconcileReminder({ enabled: false, permitted: false }, now)).toEqual({
      action: 'cancel',
    });
  });
});
