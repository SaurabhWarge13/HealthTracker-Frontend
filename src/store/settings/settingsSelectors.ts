import type { RootState } from '@/store/rootReducer';

export const selectReminderEnabled = (state: RootState) =>
  state.settings.reminderEnabled;

export const selectReminderActive = (state: RootState) =>
  state.settings.reminderEnabled && state.settings.notificationsPermitted;

export const selectReminderBlocked = (state: RootState) =>
  state.settings.reminderEnabled && !state.settings.notificationsPermitted;

export const selectNotificationsPermitted = (state: RootState) =>
  state.settings.notificationsPermitted;
