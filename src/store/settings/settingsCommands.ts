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

export const refreshNotificationPermission =
  (): Thunk<Promise<void>> => async dispatch => {
    dispatch(notificationPermissionRead(await getPermissionStatus()));
  };

export const enableReminder = (): Thunk<Promise<void>> => async dispatch => {
  dispatch(reminderEnabledChanged(true));
  dispatch(notificationPermissionRead(await requestNotificationPermission()));
};

export const disableReminder = (): Thunk => dispatch => {
  dispatch(reminderEnabledChanged(false));
};
