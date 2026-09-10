import type { RootState } from '@/store/rootReducer';

export const selectProfile = (state: RootState) => state.profile;

export const selectProfileComplete = (state: RootState) =>
  state.profile.isComplete;
