import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { loggedOut } from '@/store/auth/authSlice';

export type SettingsState = {
  reminderEnabled: boolean;
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
    builder.addCase(loggedOut, () => initialSettingsState);
  },
});

export const { notificationPermissionRead, reminderEnabledChanged } =
  settingsSlice.actions;

export const settingsReducer = settingsSlice.reducer;
