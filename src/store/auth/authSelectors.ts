import type { RootState } from '@/store/rootReducer';

export const selectHasSession = (state: RootState) => state.auth.hasSession;
export const selectPendingDeepLink = (state: RootState) =>
  state.auth.pendingDeepLink;
