export const REMINDER_HOUR = 20;

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

export function reconcileReminder(
  input: { enabled: boolean; permitted: boolean },
  now: number,
): ReminderDecision {
  return input.enabled && input.permitted
    ? { action: 'schedule', at: nextReminderAt(now) }
    : { action: 'cancel' };
}
