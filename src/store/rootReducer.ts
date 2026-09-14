import { combineReducers } from '@reduxjs/toolkit';
import { baseApi } from '@/services/api/baseApi';
import { authReducer } from './auth/authSlice';
import { checkinsReducer } from './checkins/checkinsSlice';
import { connectivityReducer } from './network/connectivitySlice';
import { healthConnectReducer } from './healthConnect/healthConnectSlice';
import { onboardingReducer } from './onboarding/onboardingSlice';
import { profileReducer } from './profile/profileSlice';
import { settingsReducer } from './settings/settingsSlice';
import { syncReducer } from './sync/syncSlice';

export const rootReducer = combineReducers({
  [baseApi.reducerPath]: baseApi.reducer,
  auth: authReducer,
  checkins: checkinsReducer,
  connectivity: connectivityReducer,
  healthConnect: healthConnectReducer,
  onboarding: onboardingReducer,
  profile: profileReducer,
  settings: settingsReducer,
  sync: syncReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
