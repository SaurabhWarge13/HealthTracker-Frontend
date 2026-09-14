import { loggedOut } from '@/store/auth/authSlice';
import {
  initialSettingsState,
  notificationPermissionRead,
  reminderEnabledChanged,
  settingsReducer,
  type SettingsState,
} from '@/store/settings/settingsSlice';
import {
  selectNotificationsPermitted,
  selectReminderActive,
  selectReminderBlocked,
  selectReminderEnabled,
} from '@/store/settings/settingsSelectors';
import type { RootState } from '@/store/rootReducer';

const reduce = (state: SettingsState, ...actions: Parameters<typeof settingsReducer>[1][]) =>
  actions.reduce((current, action) => settingsReducer(current, action), state);

const asRoot = (settings: SettingsState) => ({ settings } as RootState);

describe('defaults', () => {
  it('starts off', () => {
    expect(initialSettingsState.reminderEnabled).toBe(false);
  });

  it('starts un-permitted, so nothing is assumed before the device is asked', () => {
    expect(initialSettingsState.notificationsPermitted).toBe(false);
  });
});

describe('the toggle', () => {
  it('records what the user chose', () => {
    const on = reduce(initialSettingsState, reminderEnabledChanged(true));
    expect(selectReminderEnabled(asRoot(on))).toBe(true);

    const off = reduce(on, reminderEnabledChanged(false));
    expect(selectReminderEnabled(asRoot(off))).toBe(false);
  });

  it('is only active once the OS has also agreed', () => {
    const wanted = reduce(initialSettingsState, reminderEnabledChanged(true));

    expect(selectReminderActive(asRoot(wanted))).toBe(false);
    expect(selectReminderBlocked(asRoot(wanted))).toBe(true);

    const granted = reduce(wanted, notificationPermissionRead(true));
    expect(selectReminderActive(asRoot(granted))).toBe(true);
    expect(selectReminderBlocked(asRoot(granted))).toBe(false);
  });

  it('is not blocked when the user never asked for it', () => {
    expect(selectReminderBlocked(asRoot(initialSettingsState))).toBe(false);
  });

  it('goes back to blocked when permission is revoked later', () => {
    const armed = reduce(
      initialSettingsState,
      reminderEnabledChanged(true),
      notificationPermissionRead(true),
    );
    const revoked = reduce(armed, notificationPermissionRead(false));

    expect(selectReminderActive(asRoot(revoked))).toBe(false);
    expect(selectReminderBlocked(asRoot(revoked))).toBe(true);
    expect(selectReminderEnabled(asRoot(revoked))).toBe(true);
  });
});

describe('logging out', () => {
  it('forgets the reminder', () => {
    const armed = reduce(
      initialSettingsState,
      reminderEnabledChanged(true),
      notificationPermissionRead(true),
    );

    const afterLogout = reduce(armed, loggedOut());

    expect(afterLogout).toEqual(initialSettingsState);
    expect(selectReminderEnabled(asRoot(afterLogout))).toBe(false);
    expect(selectNotificationsPermitted(asRoot(afterLogout))).toBe(false);
  });
});
