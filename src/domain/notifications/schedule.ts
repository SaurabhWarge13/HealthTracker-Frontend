/** 8:00 PM local. Fixed for now — there is no time picker in Settings. */
export const REMINDER_HOUR = 20;

/**
 * The next 8:00 PM local time, strictly after `now`. Rolls over with `setDate`
 * rather than adding 24h: a local day is 23 or 25 hours across a DST boundary,
 * so a fixed millisecond offset shifts the reminder by an hour twice a year.
 */
export function nextReminderAt(now: number): number {
  const at = new Date(now);
  at.setHours(REMINDER_HOUR, 0, 0, 0);
  if (at.getTime() <= now) {
    at.setDate(at.getDate() + 1);
  }
  return at.getTime();
}

export type ReminderDecision =
  | { action: 'schedule'; at: number }
  | { action: 'cancel' };

/**
 * A reminder exists only when the user asked for it and the OS will deliver
 * it. `permitted` is device truth, re-read on every foreground — a toggle
 * still reading "on" after the user revoked notifications is a UI that lies.
 */
export function reconcileReminder(
  input: { enabled: boolean; permitted: boolean },
  now: number,
): ReminderDecision {
  return input.enabled && input.permitted
    ? { action: 'schedule', at: nextReminderAt(now) }
    : { action: 'cancel' };
}
