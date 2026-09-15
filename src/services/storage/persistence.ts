import { AppState } from 'react-native';
import { compactOps, normalizePendingOp } from '@/domain/sync';
import { initialAuthState } from '@/store/auth/authSlice';
import { initialCheckInsState } from '@/store/checkins/checkinsSlice';
import { initialOnboardingState } from '@/store/onboarding/onboardingSlice';
import { initialProfileState } from '@/store/profile/profileSlice';
import { initialSettingsState } from '@/store/settings/settingsSlice';
import { initialSyncState } from '@/store/sync/syncSlice';
import type { RootState } from '@/store/rootReducer';
import type { AppStore } from '@/store/store';
import { storage } from './mmkv';

const PERSIST_KEY = 'state:v1';

const SCHEMA_VERSION = 1;

const WRITE_DELAY_MS = 250;

type PersistedState = Pick<
  RootState,
  'auth' | 'checkins' | 'onboarding' | 'profile' | 'settings' | 'sync'
>;

type Envelope = { version: number; state: PersistedState };

const withSliceDefaults = (
  stored: Partial<PersistedState>,
): Partial<PersistedState> => ({
  ...stored,
  ...(stored.auth !== undefined && { auth: { ...initialAuthState, ...stored.auth } }),
  ...(stored.checkins !== undefined && {
    checkins: { ...initialCheckInsState, ...stored.checkins },
  }),
  ...(stored.onboarding !== undefined && {
    onboarding: { ...initialOnboardingState, ...stored.onboarding },
  }),
  ...(stored.profile !== undefined && {
    profile: { ...initialProfileState, ...stored.profile },
  }),
  ...(stored.settings !== undefined && {
    settings: { ...initialSettingsState, ...stored.settings },
  }),
  ...(stored.sync !== undefined && { sync: { ...initialSyncState, ...stored.sync } }),
});

const snapshot = (state: RootState): PersistedState => ({
  auth: { ...state.auth, accessToken: null },
  checkins: state.checkins,
  onboarding: state.onboarding,
  profile: state.profile,
  settings: { ...state.settings, notificationsPermitted: false },
  sync: { ...state.sync, inFlightOpId: null },
});

export function loadPersistedState(): Partial<RootState> | undefined {
  try {
    const raw = storage.getString(PERSIST_KEY);
    if (raw === undefined) {
      return undefined;
    }
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      (parsed as Envelope).version !== SCHEMA_VERSION
    ) {
      storage.delete(PERSIST_KEY);
      return undefined;
    }
    const state = withSliceDefaults((parsed as Envelope).state);

    if (state.sync !== undefined) {
      const stored = Array.isArray(state.sync.ops) ? state.sync.ops : [];
      state.sync = { ...state.sync, ops: compactOps(stored.map(normalizePendingOp)) };
    }
    return state;
  } catch {
    storage.delete(PERSIST_KEY);
    return undefined;
  }
}

export function clearPersistedState(): void {
  try {
    storage.delete(PERSIST_KEY);
  } catch { }
}

export function startPersisting(store: AppStore): () => void {
  let previous = store.getState();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const write = (state: RootState): void => {
    try {
      const keep = state.auth.userId !== null;
      if (!keep) {
        clearPersistedState();
        return;
      }
      const envelope: Envelope = {
        version: SCHEMA_VERSION,
        state: snapshot(state),
      };
      storage.set(PERSIST_KEY, JSON.stringify(envelope));
    } catch { }
  };

  const flush = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    write(store.getState());
  };

  const unsubscribeStore = store.subscribe(() => {
    const next = store.getState();
    const changed =
      next.auth !== previous.auth ||
      next.checkins !== previous.checkins ||
      next.onboarding !== previous.onboarding ||
      next.profile !== previous.profile ||
      next.settings !== previous.settings ||
      next.sync !== previous.sync;

    previous = next;
    if (!changed) {
      return;
    }

    if (timer !== null) {
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      write(store.getState());
    }, WRITE_DELAY_MS);
  });

  const appStateSubscription = AppState.addEventListener('change', next => {
    if (next !== 'active') {
      flush();
    }
  });

  return () => {
    unsubscribeStore();
    appStateSubscription.remove();
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
}
