import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { baseApi } from '@/services/api/baseApi';
import { loadPersistedState, startPersisting } from '@/services/storage';
import { rootReducer, type RootState } from './rootReducer';

/**
 * Factory so tests can build isolated stores and so boot can pass the
 * synchronously-hydrated MMKV state as `preloadedState`.
 */
export const createAppStore = (preloadedState?: Partial<RootState>) =>
  configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware().concat(baseApi.middleware),
  });

export type AppStore = ReturnType<typeof createAppStore>;
export type AppDispatch = AppStore['dispatch'];

/**
 * Hydrated at module scope, before the first render, so `RootNavigator` picks
 * the right stack on frame one instead of flashing Login and correcting
 * itself. This is the whole reason persistence is hand-written on MMKV
 * rather than delegated to redux-persist.
 */
export const store = createAppStore(loadPersistedState());

startPersisting(store);

/** Enables refetch-on-reconnect for the queries that opt into it. */
setupListeners(store.dispatch);
