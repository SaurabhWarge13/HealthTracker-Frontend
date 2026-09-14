import {
  REMINDER_HOUR,
  nextReminderAt,
  reconcileReminder,
} from '@/domain/notifications/schedule';

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
    const result = nextReminderAt(at(2026, 3, 10, 20, 0, 0));

    expect(asDate(result).getDate()).toBe(11);
    expect(asDate(result).getHours()).toBe(REMINDER_HOUR);
  });

  it('picks tomorrow once the evening has passed', () => {
    const result = nextReminderAt(at(2026, 3, 10, 20, 1));

    expect(asDate(result).getDate()).toBe(11);
  });

  it('picks tonight from the early hours of the morning', () => {
    const result = nextReminderAt(at(2026, 3, 10, 3, 0));

    expect(asDate(result).getDate()).toBe(10);
    expect(asDate(result).getHours()).toBe(REMINDER_HOUR);
  });

  it('is still 8 PM local on the day the clocks change', () => {
    const springForward = at(2026, 3, 7, 21, 0);
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
