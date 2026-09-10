/**
 * The reminder setting's promises: it starts off, it remembers what the user
 * chose, it never claims to be on when the OS says no, and it does not follow
 * one account's user into the next one's session.
 */
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

/** Only the slice under test is real; the selectors read nothing else. */
const asRoot = (settings: SettingsState) => ({ settings } as RootState);

describe('defaults', () => {
  it('starts off', () => {
    // A product promise, not an implementation detail: a reminder nobody asked
    // for is a permission prompt nobody asked for either.
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

    // Wanted, but refused: the switch reads `active`, so it shows off — and
    // Settings has something to explain rather than a silent failure.
    expect(selectReminderActive(asRoot(wanted))).toBe(false);
    expect(selectReminderBlocked(asRoot(wanted))).toBe(true);

    const granted = reduce(wanted, notificationPermissionRead(true));
    expect(selectReminderActive(asRoot(granted))).toBe(true);
    expect(selectReminderBlocked(asRoot(granted))).toBe(false);
  });

  it('is not blocked when the user never asked for it', () => {
    // Permission is denied by default on Android 13+, and showing "turn
    // notifications on in settings" to someone who never touched the toggle
    // would be noise.
    expect(selectReminderBlocked(asRoot(initialSettingsState))).toBe(false);
  });

  it('goes back to blocked when permission is revoked later', () => {
    const armed = reduce(
      initialSettingsState,
      reminderEnabledChanged(true),
      notificationPermissionRead(true),
    );
    // Turned off in system settings while the app was backgrounded, then
    // re-read on the next foreground.
    const revoked = reduce(armed, notificationPermissionRead(false));

    expect(selectReminderActive(asRoot(revoked))).toBe(false);
    expect(selectReminderBlocked(asRoot(revoked))).toBe(true);
    // The user's choice is untouched: grant permission again and it resumes.
    expect(selectReminderEnabled(asRoot(revoked))).toBe(true);
  });
});

describe('logging out', () => {
  it('forgets the reminder', () => {
    /**
     * The scenario: user A turns the reminder on and logs out, user B signs in
     * on the same device without the app being killed. Persistence wipes the
     * MMKV blob on logout, so a restart is clean — but nothing else clears
     * this slice in-process, and B would get an 8 PM reminder they never asked
     * for.
     */
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
