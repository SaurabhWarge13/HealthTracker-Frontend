/**
 * Synchronous persistence, hand-written rather than redux-persist: MMKV reads
 * synchronously, so the store is created already holding the last session and
 * `RootNavigator` picks the right stack on frame one.
 */
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

/**
 * Bumped whenever a persisted slice's shape changes. There is no migration
 * path: a mismatch drops the blob and the user signs in again, which is
 * honest for pre-release and far safer than half-migrated state.
 */
const SCHEMA_VERSION = 1;

/** Writes are batched — a check-in edit can dispatch several times in a row. */
const WRITE_DELAY_MS = 250;

/**
 * What survives a restart. `sync` matters most: it holds check-ins the server
 * has not heard about, and losing it silently discards the user's work.
 *
 * Left out on purpose — `api` is a request cache, `connectivity` restored from
 * disk would be a lie, and `healthConnect` is device truth re-read on every
 * foreground, so persisting it risks showing readings the app may no longer
 * have permission for.
 *
 * `settings` sits inside the session blob because a reminder belongs to the
 * account that turned it on. Only the user's intent is stored;
 * `notificationsPermitted` is device truth and is stripped by `snapshot`.
 */
type PersistedState = Pick<
  RootState,
  'auth' | 'checkins' | 'onboarding' | 'profile' | 'settings' | 'sync'
>;

type Envelope = { version: number; state: PersistedState };

/**
 * Fills in keys a stored slice predates. Redux replaces a preloaded slice
 * rather than merging it, so a slice written by an older build arrives missing
 * every key added since — declared in the type, `undefined` at runtime, and
 * `undefined` fails every `=== null` check written against it.
 *
 * Additive only: the stored value wins for every key it actually has, so a
 * field the user deliberately cleared cannot be resurrected by its default.
 * Written out slice by slice rather than looped, so adding a persisted slice
 * forces a line here instead of failing silently.
 */
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

/**
 * The access token is memory-only by contract (authSlice) — the refresh token
 * is the thing that survives, and it lives in the Keychain, not here.
 */
const snapshot = (state: RootState): PersistedState => ({
  auth: { ...state.auth, accessToken: null },
  checkins: state.checkins,
  onboarding: state.onboarding,
  profile: state.profile,
  // The reminder the user asked for survives; whether the OS still allows
  // notifications does not — a remembered `true` would schedule against a
  // permission that may be gone.
  settings: { ...state.settings, notificationsPermitted: false },
  // An op recorded as in flight cannot still be in flight after a restart —
  // the request died with the process. Clearing it lets the op be retried
  // rather than stranding it behind a flag nothing will ever release.
  sync: { ...state.sync, inFlightOpId: null },
});

/**
 * Reads the last session. Any failure at all — corrupt JSON, a shape from an
 * older build, MMKV itself unavailable — returns undefined so the app starts
 * clean instead of crashing on launch. A bad write must never brick startup.
 */
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

    /**
     * Nothing can be in flight at startup, so this is the one moment the queue
     * can safely be reduced: a restart mid-sync can leave two ops for one
     * check-in, and collapsing them means the app never replays a history the
     * user did not ask for.
     *
     * `normalizePendingOp` runs first, and the order is load-bearing —
     * compacting first would inherit an older op's missing fields into the
     * merged op and keep them there for good.
     */
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
  } catch {
    // Nothing useful to do; the next write overwrites it anyway.
  }
}

/**
 * Mirrors the persisted slices into MMKV. Nothing is kept while there is no
 * session — leaving one account's check-ins on disk for whoever signs in next
 * is not something to get wrong.
 *
 * Returns the unsubscribe function, which only tests need.
 */
export function startPersisting(store: AppStore): () => void {
  let previous = store.getState();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const write = (state: RootState): void => {
    try {
      // An expired session still writes: the user did not ask to throw
      // anything away, so their check-ins wait for them to sign back in. Only
      // a deliberate logout, which clears `expiredReason` too, wipes the blob.
      const keep =
        state.auth.hasSession || state.auth.expiredReason !== null;
      if (!keep) {
        clearPersistedState();
        return;
      }
      const envelope: Envelope = {
        version: SCHEMA_VERSION,
        state: snapshot(state),
      };
      storage.set(PERSIST_KEY, JSON.stringify(envelope));
    } catch {
      // Losing a write costs the last few seconds of state, not the session.
      // Throwing here would take the app down over a cache.
    }
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
    // Reference comparison on the source slices: immer gives a new object only
    // when something actually changed, so this skips the vast majority of
    // dispatches without walking any state.
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

    // A write is already scheduled; it will pick up the newest state.
    if (timer !== null) {
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      write(store.getState());
    }, WRITE_DELAY_MS);
  });

  // Batching leaves a window where a change made moments before the app is
  // swiped away never reaches disk, so the pending batch is flushed on
  // backgrounding rather than waiting out its delay.

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
