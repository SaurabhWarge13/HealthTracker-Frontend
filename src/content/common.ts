import { REMINDER_HOUR } from '@/domain/notifications/schedule';
import type { SyncOpKind } from '@/domain/sync';

export const APP_VERSION = '1.0.0 (1)';

export const NOT_SET = 'Not set';
export const EMPTY_VALUE = '—';

export const ACTION_LABEL = {
  retry: 'Retry',
  delete: 'Delete',
  continue: 'Continue',
  manage: 'Manage',
  moreOptions: 'More options',
  skipForNow: 'Skip for now',
} as const;

export const FIELD_LABEL = {
  weight: 'Weight',
  height: 'Height',
  steps: 'Steps',
  sleep: 'Sleep',
  water: 'Water',
} as const;

export const UNIT = {
  kg: 'kg',
  cm: 'cm',
  litres: 'L',
  steps: 'steps',
  hours: 'hours',
} as const;

export const GOAL_LABEL = {
  steps: 'Daily steps',
  water: 'Daily water',
  sleep: 'Nightly sleep',
  targetWeight: 'Target weight',
} as const;

export const SIGN_IN = 'Sign in';
export const EMAIL_LABEL = 'Email';
export const EMAIL_PLACEHOLDER = 'you@example.com';
export const PASSWORD_LABEL = 'Password';

export const CHECK_IN = 'Check-in';
export const NEW_CHECKIN = 'New check-in';
export const MEASUREMENTS_TITLE = 'Measurements';
export const MEASUREMENTS_SUBTITLE = 'As recorded at the time';
export const DELETE_CHECKIN_TITLE = 'Delete this check-in?';

export const deleteCheckInMessage = (when: string | null): string =>
  when === null
    ? "This entry will be removed from your history. This can't be undone."
    : `The entry from ${when} will be removed from your history. This can't be undone.`;

export const REMINDER_TIME_LABEL = `${REMINDER_HOUR % 12 || 12}:00 ${
  REMINDER_HOUR < 12 ? 'AM' : 'PM'
}`;

export const FAILED_LABEL: Record<SyncOpKind, string> = {
  create: 'A new check-in',
  update: 'An edited check-in',
  delete: 'A deleted check-in',
};

export const DISCARD_TITLE: Record<SyncOpKind, string> = {
  create: 'Discard this check-in?',
  update: 'Discard this edit?',
  delete: 'Keep this check-in after all?',
};
