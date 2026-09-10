/**
 * The one place in the app that talks to @notifee/react-native. Nothing here
 * throws at the caller, and nothing here decides whether a reminder should
 * exist — that is domain/notifications/schedule.ts.
 */
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

/**
 * One fixed id, so scheduling is idempotent: notifee replaces a trigger with
 * this id rather than stacking a second one. Reconciling on every foreground
 * would otherwise pile up a reminder per app open.
 */
const REMINDER_ID = 'daily-checkin-reminder';

/** Android notification channel. Created on demand — see scheduleReminderAt. */
const CHANNEL_ID = 'reminders';

/** Tags the notification so a press handler can tell which one was pressed. */
export const REMINDER_TYPE = 'daily-checkin-reminder';

/** Kept out of release builds; the console is a development instrument. */
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

/**
 * Reads the current permission without prompting — called on every foreground,
 * where asking again would be both wrong and invisible (iOS only ever shows
 * the system prompt once).
 */
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

/**
 * Prompts, and answers whether notifications may now be posted. Called only
 * when the user turns the reminder on in Settings, never at launch.
 */
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

/** Where the user can undo a denial. There is no in-app way back. */
export async function openSettings(): Promise<void> {
  try {
    // openNotificationSettings is Android-only; iOS has no per-channel screen.
    if (Platform.OS === 'android') {
      await notifee.openNotificationSettings();
    } else {
      await Linking.openSettings();
    }
  } catch (error) {
    log('opening settings failed', error);
  }
}

/**
 * Every Android device this app runs on requires a channel: post without one
 * and the notification is dropped silently. Called from `scheduleReminderAt`
 * rather than at startup so there is no ordering to get wrong; creating a
 * channel that already exists is a no-op.
 */
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
          /**
           * Both parts are required. Without a `pressAction` an Android
           * notification never emits `EventType.PRESS` — the tap does nothing.
           *
           * SINGLE_TOP looks optional and is not: notifee presses arrive via
           * its own receiver activity, and without the flag Android builds a
           * new MainActivity on every tap, each with its own React root, so
           * effects fire twice over and a `navigate` can land on a root that
           * is not on screen. `launchMode="singleTask"` is not enough, because
           * the flag is what the launching intent carries.
           */
          pressAction: {
            id: 'default',
            launchActivity: 'default',
            launchActivityFlags: [AndroidLaunchActivityFlag.SINGLE_TOP],
          },
        },
        ios: {
          /** Otherwise nothing shows while the app is in the foreground. */
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
        /**
         * The OS repeats this, so the reminder keeps working for someone who
         * has not opened the app in a week — a one-off trigger is only re-armed
         * by the app running, so ignoring it once would switch it off for good.
         *
         * No `alarmManager` key on purpose: the default WorkManager path needs
         * no exact-alarm permission, at the cost of inexact delivery, which is
         * the right trade for a soft daily nudge.
         */
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

/** True only for a press on OUR reminder, so unknown events are ignored. */
const isReminderPress = (event: Event): boolean =>
  event.type === EventType.PRESS &&
  event.detail.notification?.data?.type === REMINDER_TYPE;

/**
 * A press that happened while no React tree was listening. Three paths reach
 * the app and they behave differently:
 *
 *  - foreground → `onForegroundEvent` fires.
 *  - killed     → `getInitialNotification()` returns it on launch.
 *  - background → only `onBackgroundEvent` fires, and
 *    `getInitialNotification()` returns null, because the app was never
 *    launched by the notification.
 *
 * So the background handler parks the press here and the next foreground
 * consumes it. A module-scope flag suffices because a warm background app
 * still has the JS runtime the hook reads from.
 */
let pendingPress = false;

/**
 * Must be registered at module scope, before the app renders — notifee errors
 * if a notification is interacted with and no background handler exists. Lives
 * here rather than in index.js so notifee stays imported in one file.
 */
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

/**
 * Presses that arrive while the app is running. A notifee press does not come
 * through `Linking`, so this stays separate from deep-link routing.
 */
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

/**
 * Whether a press is waiting to be acted on — from a cold launch or from the
 * background. True at most once per press: both sources are cleared here, so
 * a reminder cannot spring the form open again later in the session.
 */
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
