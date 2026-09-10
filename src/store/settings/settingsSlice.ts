/**
 * App settings the user chose, plus the device fact that decides whether they
 * can take effect.
 *
 * Two fields, and the split between them is the whole design:
 *
 *  - `reminderEnabled` is **intent**, and it persists. The user asked for a
 *    reminder; that stays true until they say otherwise.
 *  - `notificationsPermitted` is **device truth**, and it never persists. It
 *    changes in system settings while the app is backgrounded, so a
 *    remembered copy is a lie waiting to be believed. `snapshot()` in
 *    persistence.ts strips it, the same way it strips the access token.
 *
 * Keeping them apart is what lets the Settings switch render
 * `enabled && permitted` — so a refused permission shows an off switch
 * without anything having to reach in and correct the user's choice, and
 * granting permission later in system settings simply starts working.
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { loggedOut } from '@/store/auth/authSlice';

export type SettingsState = {
  /**
   * Off by default, deliberately. A reminder nobody asked for is a
   * notification permission prompt nobody asked for either.
   */
  reminderEnabled: boolean;
  /** Memory-only. Re-read on every foreground; never trusted from disk. */
  notificationsPermitted: boolean;
};

export const initialSettingsState: SettingsState = {
  reminderEnabled: false,
  notificationsPermitted: false,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState: initialSettingsState,
  reducers: {
    reminderEnabledChanged(state, action: PayloadAction<boolean>) {
      state.reminderEnabled = action.payload;
    },
    notificationPermissionRead(state, action: PayloadAction<boolean>) {
      state.notificationsPermitted = action.payload;
    },
  },
  extraReducers: builder => {
    /**
     * A setting belongs to the account that chose it.
     *
     * Persistence already wipes the MMKV blob on logout, so a restart is
     * clean — but within one process nothing else clears this slice, and the
     * result is that user A logging out with the reminder on hands user B a
     * reminder at 8 PM they never turned on. Handled here rather than in
     * SettingsScreen so no call site has to remember it, mirroring
     * onboardingSlice's reset on `profileCompleted`.
     */
    builder.addCase(loggedOut, () => initialSettingsState);
  },
});

export const { notificationPermissionRead, reminderEnabledChanged } =
  settingsSlice.actions;

export const settingsReducer = settingsSlice.reducer;
