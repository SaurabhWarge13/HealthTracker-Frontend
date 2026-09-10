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

/** Opens the form a reminder is asking for. Safe before the tree is ready. */
function openCheckInForm(): void {
  if (!navigationRef.isReady()) {
    logNotifications('navigator not ready, tap dropped');
    return;
  }
  try {
    navigationRef.navigate('CheckInForm');
    logNotifications('opened check-in form');
  } catch (error) {
    // A missed reminder tap is not worth a crash, and the user is already in
    // the app by this point — but it is worth saying so in dev.
    logNotifications('navigation failed', error);
  }
}

export function useNotificationSchedule(): void {
  const dispatch = useAppDispatch();
  const enabled = useAppSelector(selectReminderEnabled);
  const permitted = useAppSelector(selectNotificationsPermitted);

  /**
   * Mount, and every return to the foreground.
   *
   * Two things happen here, both of which are only knowable on arrival: what
   * the OS currently permits (never prompts), and whether a reminder was
   * pressed while nothing was listening — a cold launch, or a press that
   * brought a backgrounded app forward.
   */
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

  /**
   * The reconcile itself. Idempotent: the service schedules under one fixed
   * id, so re-running this replaces the pending reminder rather than stacking
   * another one.
   */
  useEffect(() => {
    const decision = reconcileReminder({ enabled, permitted }, Date.now());
    if (decision.action === 'schedule') {
      scheduleReminderAt(decision.at);
    } else {
      cancelReminder();
    }
  }, [enabled, permitted]);

  /** A tap that arrives while the app is already in the foreground. */
  useEffect(() => onReminderPress(openCheckInForm), []);

  /**
   * Cancel on unmount — the boundary rule in this file's header. Kept separate
   * from the reconcile effect on purpose: that one re-runs whenever its input
   * changes, and cancelling on each of those runs would fight the schedule it
   * had just set.
   */
  useEffect(
    () => () => {
      cancelReminder();
    },
    [],
  );
}
