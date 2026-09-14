import { Linking, Platform } from 'react-native';
import notifee, {
  AndroidImportance,
  AndroidLaunchActivityFlag,
  AuthorizationStatus,
  EventType,
  RepeatFrequency,
  TriggerType,
  type Event,
} from '@notifee/react-native';

const REMINDER_ID = 'daily-checkin-reminder';

const CHANNEL_ID = 'reminders';

export const REMINDER_TYPE = 'daily-checkin-reminder';

export function log(label: string, payload?: unknown): void {
  if (!__DEV__) {
    return;
  }
  if (payload === undefined) {
    console.log(`[Notifications] ${label}`);
  } else {
    console.log(`[Notifications] ${label}`, payload);
  }
}

const isPermitted = (status: AuthorizationStatus): boolean =>
  status === AuthorizationStatus.AUTHORIZED ||
  status === AuthorizationStatus.PROVISIONAL;

export async function getPermissionStatus(): Promise<boolean> {
  try {
    const settings = await notifee.getNotificationSettings();
    log('permission status', settings.authorizationStatus);
    return isPermitted(settings.authorizationStatus);
  } catch (error) {
    log('reading permission failed', error);
    return false;
  }
}

export async function requestPermission(): Promise<boolean> {
  try {
    const settings = await notifee.requestPermission();
    log('permission requested', settings.authorizationStatus);
    return isPermitted(settings.authorizationStatus);
  } catch (error) {
    log('requesting permission failed', error);
    return false;
  }
}

export async function openSettings(): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      await notifee.openNotificationSettings();
    } else {
      await Linking.openSettings();
    }
  } catch (error) {
    log('opening settings failed', error);
  }
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Reminders',
    importance: AndroidImportance.DEFAULT,
  });
}

export async function scheduleReminderAt(timestamp: number): Promise<void> {
  try {
    await ensureChannel();
    await notifee.createTriggerNotification(
      {
        id: REMINDER_ID,
        title: "Time for today's check-in",
        body: 'It takes about ten seconds.',
        data: { type: REMINDER_TYPE },
        android: {
          channelId: CHANNEL_ID,
          pressAction: {
            id: 'default',
            launchActivity: 'default',
            launchActivityFlags: [AndroidLaunchActivityFlag.SINGLE_TOP],
          },
        },
        ios: {
          foregroundPresentationOptions: {
            alert: true,
            badge: false,
            sound: true,
          },
        },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp,
        repeatFrequency: RepeatFrequency.DAILY,
      },
    );
    log('reminder scheduled', new Date(timestamp).toString());
  } catch (error) {
    log('scheduling failed', error);
  }
}

export async function cancelReminder(): Promise<void> {
  try {
    await notifee.cancelTriggerNotification(REMINDER_ID);
    log('reminder cancelled');
  } catch (error) {
    log('cancelling failed', error);
  }
}

const isReminderPress = (event: Event): boolean =>
  event.type === EventType.PRESS &&
  event.detail.notification?.data?.type === REMINDER_TYPE;

let pendingPress = false;

export function registerBackgroundHandler(): void {
  try {
    notifee.onBackgroundEvent(async event => {
      if (isReminderPress(event)) {
        log('reminder pressed while backgrounded');
        pendingPress = true;
      }
    });
  } catch (error) {
    log('registering background handler failed', error);
  }
}

export function onReminderPress(handler: () => void): () => void {
  try {
    return notifee.onForegroundEvent(event => {
      if (isReminderPress(event)) {
        log('reminder pressed');
        handler();
      }
    });
  } catch (error) {
    log('subscribing to events failed', error);
    return () => {};
  }
}

export async function consumeReminderPress(): Promise<boolean> {
  const fromBackground = pendingPress;
  pendingPress = false;

  let fromLaunch = false;
  try {
    const initial = await notifee.getInitialNotification();
    fromLaunch = initial?.notification.data?.type === REMINDER_TYPE;
  } catch (error) {
    log('reading initial notification failed', error);
  }

  if (fromBackground || fromLaunch) {
    log('consuming press', { fromBackground, fromLaunch });
  }
  return fromBackground || fromLaunch;
}
