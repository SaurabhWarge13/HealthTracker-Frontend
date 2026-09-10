import {
  getPermissionStatus,
  requestNotificationPermission,
} from '@/services/notifications';
import type { AppDispatch } from '@/store/store';
import {
  notificationPermissionRead,
  reminderEnabledChanged,
} from './settingsSlice';

type Thunk<T = void> = (dispatch: AppDispatch) => T;

/** Reads device truth without prompting. Safe to call on every foreground. */
export const refreshNotificationPermission =
  (): Thunk<Promise<void>> => async dispatch => {
    dispatch(notificationPermissionRead(await getPermissionStatus()));
  };

/**
 * The user turned the reminder on. This is the only place that prompts, which
 * is the rule the app already follows for Health Connect: never ask for
 * something before the user has said they want it.
 *
 * Intent is recorded even if permission is refused. That is deliberate — they
 * did ask — and it is what makes the switch read off (it renders
 * `enabled && permitted`) while Settings explains why, instead of silently
 * discarding the choice they just made.
 */
export const enableReminder = (): Thunk<Promise<void>> => async dispatch => {
  dispatch(reminderEnabledChanged(true));
  dispatch(notificationPermissionRead(await requestNotificationPermission()));
};

export const disableReminder = (): Thunk => dispatch => {
  dispatch(reminderEnabledChanged(false));
};
