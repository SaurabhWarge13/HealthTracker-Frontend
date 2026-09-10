import type { RootState } from '@/store/rootReducer';

/** What the user asked for. Persisted, and not the same as "it will fire". */
export const selectReminderEnabled = (state: RootState) =>
  state.settings.reminderEnabled;

/**
 * The switch's value, and the reconciler's input: wanted AND deliverable.
 *
 * The switch shows this rather than the raw intent so it can never claim a
 * reminder is on while the OS is refusing to post notifications.
 */
export const selectReminderActive = (state: RootState) =>
  state.settings.reminderEnabled && state.settings.notificationsPermitted;

/**
 * Wanted, but the OS will not deliver it — a refusal, or a revocation in
 * system settings. The one case where Settings has something to explain.
 */
export const selectReminderBlocked = (state: RootState) =>
  state.settings.reminderEnabled && !state.settings.notificationsPermitted;

export const selectNotificationsPermitted = (state: RootState) =>
  state.settings.notificationsPermitted;
