import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { reconcileReminder } from '@/domain/notifications/schedule';
import { navigationRef } from '@/navigation/navigationRef';
import {
  cancelReminder,
  consumeReminderPress,
  logNotifications,
  onReminderPress,
  scheduleReminderAt,
} from '@/services/notifications';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { refreshNotificationPermission } from '@/store/settings/settingsCommands';
import {
  selectNotificationsPermitted,
  selectReminderEnabled,
} from '@/store/settings/settingsSelectors';

function openCheckInForm(): void {
  if (!navigationRef.isReady()) {
    logNotifications('navigator not ready, tap dropped');
    return;
  }
  try {
    navigationRef.navigate('CheckInForm');
    logNotifications('opened check-in form');
  } catch (error) {
    logNotifications('navigation failed', error);
  }
}

export function useNotificationSchedule(): void {
  const dispatch = useAppDispatch();
  const enabled = useAppSelector(selectReminderEnabled);
  const permitted = useAppSelector(selectNotificationsPermitted);

  useEffect(() => {
    const onArrive = (): void => {
      dispatch(refreshNotificationPermission());
      consumeReminderPress().then(pressed => {
        if (pressed) {
          openCheckInForm();
        }
      });
    };

    onArrive();

    let previous: AppStateStatus = AppState.currentState;
    const subscription = AppState.addEventListener('change', next => {
      const wasAway = previous !== 'active';
      previous = next;
      if (wasAway && next === 'active') {
        onArrive();
      }
    });

    return () => subscription.remove();
  }, [dispatch]);

  useEffect(() => {
    const decision = reconcileReminder({ enabled, permitted }, Date.now());
    if (decision.action === 'schedule') {
      scheduleReminderAt(decision.at);
    } else {
      cancelReminder();
    }
  }, [enabled, permitted]);

  useEffect(() => onReminderPress(openCheckInForm), []);

  useEffect(
    () => () => {
      cancelReminder();
    },
    [],
  );
}
